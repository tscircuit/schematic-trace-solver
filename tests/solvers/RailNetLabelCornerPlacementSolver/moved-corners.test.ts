import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { RailNetLabelCornerPlacementSolver } from "lib/solvers/RailNetLabelCornerPlacementSolver/RailNetLabelCornerPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { createTrace } from "../TraceCleanupSolver/fixtures/alignSameNetRails"

const createFixture = (anchorPoint = { x: 1, y: 2 }) => {
  const path = [
    { x: -1, y: 3 },
    { x: -2, y: 3 },
    { x: -2, y: 2 },
    { x: 1, y: 2 },
    { x: 1, y: 0 },
    { x: 0, y: 0 },
  ]
  const originalTrace = createTrace("power", path, [
    { pinId: "R1.1", chipId: "R1", ...path[0]! },
    { pinId: "U1.VCC", chipId: "U1", ...path.at(-1)! },
  ])
  const trace = {
    ...originalTrace,
    tracePath: path.map((point) =>
      point.x === 1 ? { ...point, x: 3 } : point,
    ),
  }
  const label: NetLabelPlacement = {
    globalConnNetId: trace.globalConnNetId,
    netId: "VCC",
    mspConnectionPairIds: [trace.mspPairId],
    pinIds: trace.pinIds,
    orientation: "y+",
    anchorPoint,
    center: { x: anchorPoint.x, y: anchorPoint.y + 0.2 },
    width: 0.6,
    height: 0.4,
  }
  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: { VCC: ["y+"] },
  }
  return {
    inputProblem,
    originalTraces: [originalTrace],
    traces: [trace],
    netLabelPlacements: [label],
  }
}

test.each([false, true])(
  "reanchors a removed rail corner with overlap revalidation=%s",
  (onlyOverlappingLabels) => {
    const input = createFixture()
    const solver = new RailNetLabelCornerPlacementSolver({
      ...input,
      onlyOverlappingLabels,
    })
    solver.solve()

    expect(solver.getOutput().netLabelPlacements[0]!.anchorPoint).toEqual({
      x: 3,
      y: 2,
    })
    expect(solver.getOutput().traces).toEqual(input.traces)
    expect(input.netLabelPlacements[0]!.anchorPoint).toEqual({ x: 1, y: 2 })
  },
)

test("rechecks a crossed label even when its original corner has not moved", () => {
  const input = createFixture({ x: 3, y: 0 })
  input.originalTraces = input.traces
  const solver = new RailNetLabelCornerPlacementSolver({
    ...input,
    onlyOverlappingLabels: true,
  })
  solver.solve()

  expect(solver.getOutput().netLabelPlacements[0]!.anchorPoint).toEqual({
    x: 3,
    y: 2,
  })
  expect(solver.getOutput().traces).toEqual(input.traces)
})

test.each([
  { x: -2, y: 3 },
  { x: -0.5, y: 2 },
])("preserves an unaffected corner or segment anchor at %j", (anchorPoint) => {
  const input = createFixture(anchorPoint)
  const solver = new RailNetLabelCornerPlacementSolver(input)
  solver.solve()

  expect(solver.getOutput().netLabelPlacements).toEqual(
    input.netLabelPlacements,
  )
  expect(solver.getOutput().traces).toEqual(input.traces)
})

test("does not move a rail label into text at the new corner", () => {
  const input = createFixture()
  input.inputProblem.textBoxes = [
    { center: { x: 3, y: 2.2 }, width: 0.6, height: 0.4, text: "U2" },
  ]
  const solver = new RailNetLabelCornerPlacementSolver(input)
  solver.solve()

  const label = solver.getOutput().netLabelPlacements[0]!
  expect(label.anchorPoint).not.toEqual({ x: 3, y: 2 })
  const text = input.inputProblem.textBoxes[0]!
  const overlapsText =
    Math.abs(label.center.x - text.center.x) < (label.width + text.width) / 2 &&
    Math.abs(label.center.y - text.center.y) < (label.height + text.height) / 2
  expect(overlapsText).toBe(false)
})

test("reanchors a downward rail label after the same mirrored reroute", () => {
  const input = createFixture()
  for (const trace of [...input.originalTraces, ...input.traces]) {
    trace.tracePath = trace.tracePath.map(({ x, y }) => ({ x, y: -y }))
    trace.pins = [
      { ...trace.pins[0], y: -trace.pins[0].y },
      { ...trace.pins[1], y: -trace.pins[1].y },
    ]
  }
  const label = input.netLabelPlacements[0]!
  label.orientation = "y-"
  label.anchorPoint = { x: 1, y: -2 }
  label.center = { x: 1, y: -2.2 }
  input.inputProblem.availableNetLabelOrientations.VCC = ["y-"]

  const solver = new RailNetLabelCornerPlacementSolver(input)
  solver.solve()

  expect(solver.getOutput().netLabelPlacements[0]!.anchorPoint).toEqual({
    x: 3,
    y: -2,
  })
  expect(solver.getOutput().traces).toEqual(input.traces)
})
