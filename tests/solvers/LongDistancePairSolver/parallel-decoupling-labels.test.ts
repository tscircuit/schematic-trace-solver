import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createBank = (): InputProblem => ({
  chips: [0, 2, 4].map((x, index) => ({
    chipId: `C${index + 1}`,
    center: { x, y: 0 },
    width: 0.6,
    height: 0.8,
    pins: [
      { pinId: `C${index + 1}.1`, x, y: 0.4 },
      { pinId: `C${index + 1}.2`, x, y: -0.4 },
    ],
  })),
  directConnections: [],
  netConnections: [
    { netId: "VDD", pinIds: ["C1.1", "C2.1", "C3.1"] },
    { netId: "GND", pinIds: ["C1.2", "C2.2", "C3.2"] },
  ],
  availableNetLabelOrientations: { VDD: ["y+"], GND: ["y-"] },
  maxMspPairDistance: 1,
})

const solve = (input: InputProblem) => {
  const solver = new SchematicTracePipelineSolver(input)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  return solver
}

for (const rotated of [false, true]) {
  test(`distant parallel capacitors get local labels (rotated=${rotated})`, () => {
    const input = createBank()
    if (rotated) {
      for (const chip of input.chips) {
        chip.center = { x: chip.center.y, y: chip.center.x }
        ;[chip.width, chip.height] = [chip.height, chip.width]
        for (const pin of chip.pins) [pin.x, pin.y] = [pin.y, pin.x]
      }
      input.availableNetLabelOrientations = { VDD: ["x+"], GND: ["x-"] }
    }
    // Distance rules should not depend on pin order or component metadata.
    input.chips[1]!.pins.reverse()
    const solver = solve(input)
    expect(solver.longDistancePairSolver!.getOutput().newTraces).toEqual([])
    const labels = solver.netLabelToTraceSolver!.getOutput().netLabelPlacements
    for (const pin of input.chips.flatMap((chip) => chip.pins)) {
      expect(
        labels.filter((label) => label.pinIds.includes(pin.pinId)),
      ).toHaveLength(1)
    }
  })
}

test("keeps shared rails within the configured routing distance", () => {
  const input = createBank()
  input.maxMspPairDistance = 2
  const solver = solve(input)
  expect(solver.mspConnectionPairSolver!.mspConnectionPairs).toHaveLength(4)
  expect(
    solver.netLabelToTraceSolver!.getOutput().netLabelPlacements,
  ).toHaveLength(2)
})

test("preserves explicitly wired rails while labeling the independent ground pins", () => {
  const input = createBank()
  input.directConnections = [
    { pinIds: ["C1.1", "C2.1"] },
    { pinIds: ["C2.1", "C3.1"] },
  ]
  const solver = solve(input)
  const recovered = solver.longDistancePairSolver!.getOutput().newTraces
  expect(recovered.length).toBeGreaterThan(0)
  expect(
    recovered.every((trace) => trace.pinIds.every((pin) => pin.endsWith(".1"))),
  ).toBe(true)
})

test("direct connections with fallback labels do not recreate the bank wires", () => {
  const input = createBank()
  input.directConnections = [
    { pinIds: ["C1.1", "C2.1"], netLabelWidth: 0.5 },
    { pinIds: ["C2.1", "C3.1"], netLabelWidth: 0.5 },
  ]
  expect(solve(input).longDistancePairSolver!.getOutput().newTraces).toEqual([])
})

test("recognizes a ground alias by its metadata and global connectivity", () => {
  const input = createBank()
  input.netConnections[1]!.netId = "return-net"
  input.netConnections[1]!.isGround = true
  input.netConnections.push({ netId: "alias", pinIds: ["C1.2"] })
  input.availableNetLabelOrientations = { VDD: ["y+"], "return-net": ["y-"] }
  expect(solve(input).longDistancePairSolver!.getOutput().newTraces).toEqual([])
})

test("preserves long-distance recovery for unrelated signal connections", () => {
  const input = createBank()
  input.netConnections[1]!.netId = "SIGNAL"
  expect(
    solve(input).longDistancePairSolver!.getOutput().newTraces.length,
  ).toBeGreaterThan(0)
})

test("keeps distant net-only loads local even when they are staggered", () => {
  const input = createBank()
  for (const [index, chip] of input.chips.entries()) {
    chip.center.y += index * 2
    for (const pin of chip.pins) pin.y += index * 2
  }
  expect(solve(input).longDistancePairSolver!.getOutput().newTraces).toEqual([])
})

test("different-size components do not bypass the net connection distance", () => {
  const input = createBank()
  for (const [index, chip] of input.chips.entries()) {
    chip.height += index * 0.2
    chip.pins[0]!.y += index * 0.1
    chip.pins[1]!.y -= index * 0.1
  }
  const solver = solve(input)
  expect(solver.longDistancePairSolver!.getOutput().newTraces).toEqual([])
  expect(
    solver.netLabelToTraceSolver!.getOutput().netLabelPlacements,
  ).toHaveLength(6)
})

test("parallel branch labeling does not depend on optional symbol metadata", () => {
  const input = createBank()
  for (const chip of input.chips) chip.symbolName = "resistor"
  const solver = solve(input)
  expect(solver.longDistancePairSolver!.getOutput().newTraces).toEqual([])
  expect(
    solver.netLabelToTraceSolver!.getOutput().netLabelPlacements,
  ).toHaveLength(6)
})

test("recognizes parallel banks across named-net aliases", () => {
  const input = createBank()
  input.netConnections = [
    { netId: "VDD", pinIds: ["C1.1", "C2.1"] },
    { netId: "VDD_ALIAS", pinIds: ["C2.1", "C3.1"] },
    input.netConnections[1]!,
  ]
  expect(solve(input).longDistancePairSolver!.getOutput().newTraces).toEqual([])
})

test("final label-to-trace recovery preserves local bank labels", () => {
  const input = createBank()
  input.netConnections[0]!.isGround = false
  input.netConnections[1]!.isGround = true
  const output = solve(input).netLabelToTraceSolver!.getOutput()
  expect(output.traces.filter((trace) => trace.pinIds.length > 1)).toEqual([])
  expect(output.netLabelPlacements).toHaveLength(6)
})

test("an explicit bank wire does not extend to other branches", () => {
  const input = createBank()
  input.directConnections = [{ pinIds: ["C1.1", "C2.1"] }]
  const traces = solve(input).longDistancePairSolver!.getOutput().newTraces
  expect(traces.map((trace) => [...trace.pinIds].sort())).toEqual([
    ["C1.1", "C2.1"],
  ])
})

test("branches on different named rails retain their existing recovery", () => {
  const input = createBank()
  input.netConnections = [
    { netId: "VDD1", pinIds: ["C1.1"] },
    { netId: "VDD2", pinIds: ["C2.1"] },
    { netId: "VDD3", pinIds: ["C3.1"] },
    input.netConnections[1]!,
  ]
  expect(
    solve(input).longDistancePairSolver!.getOutput().newTraces.length,
  ).toBeGreaterThan(0)
})

test("loads connected through source wires retain their existing recovery", () => {
  const input = createBank()
  input.netConnections[0]!.pinIds = ["C1.1"]
  input.directConnections = [
    { pinIds: ["C1.1", "C2.1"] },
    { pinIds: ["C2.1", "C3.1"] },
  ]
  const traces = solve(input).longDistancePairSolver!.getOutput().newTraces
  expect(
    traces.some((trace) => trace.pinIds.every((pinId) => pinId.endsWith(".2"))),
  ).toBe(true)
})
