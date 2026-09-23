import { expect, test } from "bun:test"
import { getPathLength } from "lib/solvers/Example28Solver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { TraceElbowTransitionSimplificationSolver } from "lib/solvers/TraceElbowTransitionSimplificationSolver/TraceElbowTransitionSimplificationSolver"
import { countTurns } from "lib/solvers/TraceCleanupSolver/countTurns"
import type { InputProblem } from "lib/types/InputProblem"
import { createTrace } from "../TraceCleanupSolver/fixtures/alignSameNetRails"

const createFixture = () => {
  const path = [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: -2, y: 1 },
    { x: -2, y: 2 },
    { x: -1, y: 2 },
    { x: -1, y: 3 },
    { x: -3, y: 3 },
    { x: -3, y: 4 },
    { x: -1, y: 4 },
    { x: -1, y: 5 },
    { x: 0, y: 5 },
  ]
  const trace = createTrace("rerouted", path, [
    { pinId: "U1.1", chipId: "U1", ...path[0]!, _facingDirection: "x-" },
    { pinId: "U1.2", chipId: "U1", ...path.at(-1)!, _facingDirection: "x-" },
  ])
  const labels: NetLabelPlacement[] = [
    { x: -1, y: 1.5, width: 1 },
    { x: -1.5, y: 3.5, width: 2 },
  ].map(({ x, y, width }, index) => ({
    globalConnNetId: `signal-${index}`,
    netId: `SIGNAL_${index}`,
    mspConnectionPairIds: [],
    pinIds: [],
    orientation: "x-",
    anchorPoint: { x: x + width / 2, y },
    center: { x, y },
    width,
    height: 0.5,
  }))
  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  return {
    inputProblem,
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
    allowShorterPaths: true,
  }
}

test("shortens successive label detours until only the outer rail remains", () => {
  const input = createFixture()
  const solver = new TraceElbowTransitionSimplificationSolver(input)
  solver.solve()
  const path = solver.getOutput().traces[0]!.tracePath

  expect(path).toEqual([
    { x: 0, y: 0 },
    { x: -3, y: 0 },
    { x: -3, y: 5 },
    { x: 0, y: 5 },
  ])
  expect(getPathLength(path)).toBeLessThan(
    getPathLength(input.traces[0]!.tracePath),
  )
})

test("retains length in the early equivalent-path pass", () => {
  const input = createFixture()
  input.allowShorterPaths = false
  const solver = new TraceElbowTransitionSimplificationSolver(input)
  solver.solve()
  expect(getPathLength(solver.getOutput().traces[0]!.tracePath)).toBeCloseTo(
    getPathLength(input.traces[0]!.tracePath),
  )
})

test.each(["anchor", "branch", "crossing"] as const)(
  "keeps an attached same-net %s connected when shortening detours",
  (attachment) => {
    const input = createFixture()
    const junction = { x: -1, y: 2.5 }
    if (attachment === "anchor") {
      input.netLabelPlacements.push({
        globalConnNetId: "power-net",
        netId: "POWER",
        mspConnectionPairIds: ["rerouted"],
        pinIds: [],
        orientation: "x+",
        anchorPoint: junction,
        center: { x: -0.8, y: 2.5 },
        width: 0.4,
        height: 0.2,
      })
    } else {
      const start = attachment === "branch" ? junction : { x: -1.5, y: 2.5 }
      const end = { x: 0, y: 2.5 }
      input.traces.push(
        createTrace(
          "attached",
          [start, end],
          [
            { pinId: "U2.1", chipId: "U2", ...start },
            { pinId: "U3.1", chipId: "U3", ...end },
          ],
        ),
      )
    }
    const solver = new TraceElbowTransitionSimplificationSolver(input)
    solver.solve()
    expect(
      tracePathContainsPoint(solver.getOutput().traces[0]!.tracePath, junction),
    ).toBe(true)
  },
)

test.each(["component", "label", "parallel_trace", "crossing_trace"] as const)(
  "keeps a necessary detour around a %s",
  (blocker) => {
    const input = createFixture()
    const center = { x: -3, y: 2.5 }
    if (blocker === "component") {
      input.inputProblem.chips.push({
        chipId: "obstacle",
        center,
        width: 0.2,
        height: 0.2,
        pins: [],
      })
    } else if (blocker === "label") {
      input.netLabelPlacements.push({
        globalConnNetId: "obstacle",
        netId: "OBSTACLE",
        mspConnectionPairIds: [],
        pinIds: [],
        orientation: "x+",
        anchorPoint: { x: -3.1, y: 2.5 },
        center,
        width: 0.2,
        height: 0.2,
      })
    } else {
      const path =
        blocker === "parallel_trace"
          ? [
              { x: -3, y: 2.4 },
              { x: -3, y: 2.6 },
            ]
          : [
              { x: -3.1, y: 2.5 },
              { x: -2.9, y: 2.5 },
            ]
      input.traces.push(
        createTrace(
          "obstacle",
          path,
          [
            { pinId: "U2.1", chipId: "U2", ...path[0]! },
            { pinId: "U3.1", chipId: "U3", ...path[1]! },
          ],
          "other-net",
        ),
      )
    }
    const solver = new TraceElbowTransitionSimplificationSolver(input)
    solver.solve()
    const path = solver.getOutput().traces[0]!.tracePath
    expect(tracePathContainsPoint(path, center)).toBe(false)
    expect(countTurns(path)).toBeGreaterThan(2)
  },
)
