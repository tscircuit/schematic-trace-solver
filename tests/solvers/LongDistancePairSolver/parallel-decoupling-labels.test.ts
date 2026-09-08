import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getTraceConnectedPinComponents } from "lib/solvers/SchematicTraceLinesSolver/getTraceConnectedPinComponents"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

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
  test(`aligned parallel capacitors share rails (rotated=${rotated})`, async () => {
    const input = createBank()
    if (rotated) {
      for (const chip of input.chips) {
        chip.center = { x: chip.center.y, y: chip.center.x }
        ;[chip.width, chip.height] = [chip.height, chip.width]
        for (const pin of chip.pins) [pin.x, pin.y] = [pin.y, pin.x]
      }
      input.availableNetLabelOrientations = { VDD: ["x+"], GND: ["x-"] }
    }
    // Rail detection should not depend on pin order or component metadata.
    input.chips[1]!.pins.reverse()
    const solver = solve(input)
    expect(solver.longDistancePairSolver!.getOutput().newTraces).toEqual([])
    const { traces, netLabelPlacements } =
      solver.netLabelToTraceSolver!.getOutput()
    expect(netLabelPlacements).toHaveLength(2)
    expect(traces).toHaveLength(4)
    for (const net of input.netConnections) {
      const components = getTraceConnectedPinComponents({
        pinIds: net.pinIds,
        traces,
      })
      expect(components).toHaveLength(1)
      // Every rail stays outside the component bodies on its own side.
      const sign = net.netId === "GND" ? -1 : 1
      for (const trace of components[0]!.traces) {
        for (const point of trace.tracePath) {
          expect(sign * point[rotated ? "x" : "y"]).toBeGreaterThanOrEqual(
            0.4 - 1e-6,
          )
        }
      }
    }
    await expect(solver).toMatchSolverSnapshot(
      import.meta.path,
      rotated ? "vertical-rails" : "horizontal-rails",
    )
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

test("fallback labels allow shared rails without long-distance recovery", () => {
  const input = createBank()
  input.directConnections = [
    { pinIds: ["C1.1", "C2.1"], netLabelWidth: 0.5 },
    { pinIds: ["C2.1", "C3.1"], netLabelWidth: 0.5 },
  ]
  const solver = solve(input)
  expect(solver.longDistancePairSolver!.getOutput().newTraces).toEqual([])
  expect(
    solver.netLabelToTraceSolver!.getOutput().netLabelPlacements,
  ).toHaveLength(2)
})

test("recognizes a ground alias by its metadata and global connectivity", () => {
  const input = createBank()
  input.netConnections[1]!.netId = "return-net"
  input.netConnections[1]!.isGround = true
  input.netConnections.push({ netId: "alias", pinIds: ["C1.2"] })
  input.availableNetLabelOrientations = { VDD: ["y+"], "return-net": ["y-"] }
  const solver = solve(input)
  expect(solver.longDistancePairSolver!.getOutput().newTraces).toEqual([])
  expect(solver.mspConnectionPairSolver!.mspConnectionPairs).toHaveLength(4)
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

test("final label-to-trace recovery preserves shared bank rails", () => {
  const input = createBank()
  input.netConnections[0]!.isGround = false
  input.netConnections[1]!.isGround = true
  const output = solve(input).netLabelToTraceSolver!.getOutput()
  expect(output.traces.filter((trace) => trace.pinIds.length > 1)).toHaveLength(
    4,
  )
  expect(output.netLabelPlacements).toHaveLength(2)
})

test("an explicit bank wire does not extend to other branches", () => {
  const input = createBank()
  input.directConnections = [{ pinIds: ["C1.1", "C2.1"] }]
  const traces = solve(input).longDistancePairSolver!.getOutput().newTraces
  expect(traces.map((trace) => [...trace.pinIds].sort())).toEqual([
    ["C1.1", "C2.1"],
  ])
})

test("different supplies share only the ground rail", () => {
  const input = createBank()
  input.netConnections = [
    { netId: "VDD1", pinIds: ["C1.1"] },
    { netId: "VDD2", pinIds: ["C2.1"] },
    { netId: "VDD3", pinIds: ["C3.1"] },
    input.netConnections[1]!,
  ]
  const output = solve(input).netLabelToTraceSolver!.getOutput()
  expect(output.traces).toHaveLength(2)
  expect(
    output.traces.every((trace) =>
      trace.pinIds.every((pinId) => pinId.endsWith(".2")),
    ),
  ).toBe(true)
  expect(output.netLabelPlacements).toHaveLength(4)
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

test("two aligned capacitors can share both rails beyond the local distance", () => {
  const input = createBank()
  input.chips.pop()
  for (const net of input.netConnections) net.pinIds.pop()
  const solver = solve(input)
  expect(solver.mspConnectionPairSolver!.mspConnectionPairs).toHaveLength(2)
  expect(
    solver.netLabelToTraceSolver!.getOutput().netLabelPlacements,
  ).toHaveLength(2)
})

test("an intervening component breaks the shared rail", () => {
  const input = createBank()
  input.chips.push({
    chipId: "barrier",
    center: { x: 1, y: 0.6 },
    width: 0.2,
    height: 0.8,
    pins: [],
  })
  const output = solve(input).netLabelToTraceSolver!.getOutput()
  expect(output.traces).toHaveLength(2)
  expect(
    output.traces.every(
      (trace) => !trace.pinIds.some((pinId) => pinId.startsWith("C1.")),
    ),
  ).toBe(true)
  expect(
    output.netLabelPlacements.filter((label) =>
      label.pinIds.some((pinId) => pinId.startsWith("C1.")),
    ),
  ).toHaveLength(2)
})

test("shared rails stay within their schematic section", () => {
  const input = createBank()
  input.chips[2]!.sectionId = "separate"
  const output = solve(input).netLabelToTraceSolver!.getOutput()
  expect(output.traces).toHaveLength(2)
  expect(
    output.traces.every(
      (trace) => !trace.pinIds.some((pinId) => pinId.startsWith("C3.")),
    ),
  ).toBe(true)
  expect(output.netLabelPlacements).toHaveLength(4)
})

test("a common ground rail does not recover wires across interleaved supplies", () => {
  const input = createBank()
  input.chips = [0, 2, 4, 6, 8, 10].map((x, index) => ({
    chipId: `C${index + 1}`,
    center: { x, y: 0 },
    width: 0.6,
    height: 0.8,
    pins: [
      { pinId: `C${index + 1}.1`, x, y: 0.4 },
      { pinId: `C${index + 1}.2`, x, y: -0.4 },
    ],
  }))
  input.netConnections = [
    { netId: "VDD", isGround: false, pinIds: ["C1.1", "C3.1", "C5.1"] },
    { netId: "VEE", isGround: false, pinIds: ["C2.1", "C4.1", "C6.1"] },
    {
      netId: "GND",
      isGround: true,
      pinIds: input.chips.map((chip) => chip.pins[1]!.pinId),
    },
  ]
  const solver = solve(input)
  const output = solver.netLabelToTraceSolver!.getOutput()
  expect(solver.longDistancePairSolver!.getOutput().newTraces).toHaveLength(0)
  expect(output.traces).toHaveLength(5)
  expect(
    output.traces.every((trace) =>
      trace.pinIds.every((pinId) => pinId.endsWith(".2")),
    ),
  ).toBe(true)
  expect(output.netLabelPlacements).toHaveLength(7)
})

test("decoupling row shares GND while keeping DEC supplies separate", async () => {
  const input = createBank()
  input.chips = Array.from({ length: 6 }, (_, index) => ({
    chipId: [
      "C_MCU_VDD1",
      "C_MCU_VDD3",
      "C_MCU_VDD2",
      "C_MCU_DEC1",
      "C_MCU_DEC3",
      "C_MCU_DEC4",
    ][index]!,
    symbolName: "capacitor_down",
    center: { x: index * 3, y: 0 },
    width: 0.6,
    height: 0.76,
    pins: [
      { pinId: `C${index + 1}.1`, x: index * 3, y: 0.38 },
      { pinId: `C${index + 1}.2`, x: index * 3, y: -0.38 },
    ],
  }))
  input.netConnections = [
    { netId: "V3V3", netLabelText: "V3V3", pinIds: ["C1.1", "C2.1", "C3.1"] },
    ...["DEC1", "DEC3", "DEC4"].map((netId, index) => ({
      netId,
      netLabelText: netId,
      pinIds: [`C${index + 4}.1`],
    })),
    {
      netId: "GND",
      isGround: true,
      netLabelText: "GND",
      pinIds: input.chips.map((chip) => chip.pins[1]!.pinId),
    },
  ]
  input.availableNetLabelOrientations = {
    V3V3: ["y+"],
    DEC1: ["y+"],
    DEC3: ["y+"],
    DEC4: ["y+"],
    GND: ["y-"],
  }
  const solver = solve(input)
  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  expect(traces).toHaveLength(7)
  expect(netLabelPlacements).toHaveLength(5)
  for (const net of input.netConnections) {
    expect(
      getTraceConnectedPinComponents({ pinIds: net.pinIds, traces }),
    ).toHaveLength(1)
    expect(
      netLabelPlacements.filter((label) => label.netId === net.netId),
    ).toHaveLength(1)
  }
  for (const trace of traces) {
    const pinNets = trace.pinIds.map(
      (pinId) =>
        input.netConnections.find((net) => net.pinIds.includes(pinId))!.netId,
    )
    expect(new Set(pinNets).size).toBe(1)
  }
  await expect(solver).toMatchSolverSnapshot(
    import.meta.path,
    "decoupling-mixed-supplies",
  )
})
