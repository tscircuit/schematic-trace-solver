import { expect, test } from "bun:test"
import { getPathLength } from "lib/solvers/Example28Solver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { TraceElbowTransitionSimplificationSolver } from "lib/solvers/TraceElbowTransitionSimplificationSolver/TraceElbowTransitionSimplificationSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { createTrace } from "../TraceCleanupSolver/fixtures/alignSameNetRails"

const createFixture = () => {
  const path = [
    { x: 5, y: 0 },
    { x: 5, y: -1 },
    { x: 2.5, y: -1 },
    { x: 2.5, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 3 },
    { x: 1, y: 3 },
    { x: 1, y: 4 },
  ]
  const trace = createTrace("rerouted", path, [
    { pinId: "C1.1", chipId: "C1", x: 5, y: 0, _facingDirection: "y-" },
    { pinId: "L1.1", chipId: "L1", x: 1, y: 4, _facingDirection: "y-" },
  ])
  const labels: NetLabelPlacement[] = [
    {
      globalConnNetId: "signal",
      netId: "SIGNAL",
      mspConnectionPairIds: [],
      pinIds: [],
      orientation: "x+",
      anchorPoint: { x: 0.5, y: 0.7 },
      center: { x: 1.45, y: 0.7 },
      width: 1.9,
      height: 2.4,
    },
    {
      globalConnNetId: "signal2",
      netId: "SIGNAL2",
      mspConnectionPairIds: [],
      pinIds: [],
      orientation: "x+",
      anchorPoint: { x: 0.5, y: 2.45 },
      center: { x: 1.2, y: 2.45 },
      width: 1.4,
      height: 0.9,
    },
  ]
  const problem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  return {
    inputProblem: problem,
    traces: [trace],
    completedReroutes: [
      {
        initialTrace: trace,
        reroutedTracePath: path,
        label: labels[0]!,
        detourCount: 0,
      },
    ],
    netLabelPlacements: labels,
    paddingBuffer: 0.1,
  }
}

test("merges successive label detours without changing length or terminal directions", () => {
  const input = createFixture()
  const solver = new TraceElbowTransitionSimplificationSolver(input)
  solver.solve()
  const path = solver.getOutput().traces[0]!.tracePath

  expect(path).toEqual([
    { x: 5, y: 0 },
    { x: 5, y: -1 },
    { x: 2.5, y: -1 },
    { x: 2.5, y: 3 },
    { x: 1, y: 3 },
    { x: 1, y: 4 },
  ])
  expect(getPathLength(path)).toBeCloseTo(
    getPathLength(input.traces[0]!.tracePath),
  )
})

test.each([
  "component",
  "label",
  "parallel_trace",
  "crossing_trace",
  "anchor",
] as const)("preserves a necessary staircase blocked by %s", (blocker) => {
  const input = createFixture()
  if (blocker === "component") {
    input.inputProblem.chips.push({
      chipId: "obstacle",
      center: { x: 2.5, y: 2.5 },
      width: 0.2,
      height: 0.4,
      pins: [],
    })
  } else if (blocker === "parallel_trace" || blocker === "crossing_trace") {
    const path =
      blocker === "parallel_trace"
        ? [
            { x: 2.5, y: 2.2 },
            { x: 2.5, y: 2.8 },
          ]
        : [
            { x: 2.3, y: 2.5 },
            { x: 2.7, y: 2.5 },
          ]
    input.traces.push(
      createTrace(
        "foreign",
        path,
        [
          { pinId: "X1.1", chipId: "X1", ...path[0]! },
          { pinId: "X2.1", chipId: "X2", ...path[1]! },
        ],
        "foreign",
      ),
    )
  } else {
    const x = blocker === "anchor" ? 2 : 2.5
    input.netLabelPlacements.push({
      globalConnNetId: blocker === "anchor" ? "power-net" : "foreign",
      netId: "BLOCKER",
      mspConnectionPairIds: ["rerouted"],
      pinIds: [],
      orientation: "x+",
      anchorPoint: { x, y: 2.5 },
      center: { x: x + 0.1, y: 2.5 },
      width: 0.2,
      height: 0.4,
    })
  }
  const solver = new TraceElbowTransitionSimplificationSolver(input)
  solver.solve()

  expect(solver.getOutput().traces[0]!.tracePath).toEqual(
    input.traces[0]!.tracePath,
  )
})
