import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { TraceOverlapIssueSolver } from "lib/solvers/TraceOverlapShiftSolver/TraceOverlapIssueSolver/TraceOverlapIssueSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath => {
  const firstPoint = tracePath[0]!
  const lastPoint = tracePath[tracePath.length - 1]!
  const pins: SolvedTracePath["pins"] = [
    {
      pinId: `${mspPairId}.start`,
      chipId: "test-chip",
      x: firstPoint.x,
      y: firstPoint.y,
    },
    {
      pinId: `${mspPairId}.end`,
      chipId: "test-chip",
      x: lastPoint.x,
      y: lastPoint.y,
    },
  ]

  return {
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: pins.map((pin) => pin.pinId),
  }
}

test("chooses the overlap offset direction with fewer cross-net intersections", () => {
  const traceNetIslands = {
    netA: [
      makeTrace("traceA", "netA", [
        { x: 0, y: 1 },
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 1 },
      ]),
    ],
    netB: [
      makeTrace("traceB", "netB", [
        { x: 0, y: -1 },
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: -1 },
      ]),
    ],
    fixedNet: [
      makeTrace("fixedTrace", "fixedNet", [
        { x: -1, y: -0.05 },
        { x: 1, y: -0.05 },
      ]),
    ],
  }

  const solver = new TraceOverlapIssueSolver({
    traceNetIslands,
    overlappingTraceSegments: [
      {
        connNetId: "netA",
        pathsWithOverlap: [{ solvedTracePathIndex: 0, traceSegmentIndex: 1 }],
      },
      {
        connNetId: "netB",
        pathsWithOverlap: [{ solvedTracePathIndex: 0, traceSegmentIndex: 1 }],
      },
    ],
  })

  solver.solve()

  expect(solver.correctedTraceMap.traceA!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 0, y: 0.1 },
    { x: 5, y: 0.1 },
    { x: 5, y: 1 },
  ])
  expect(solver.correctedTraceMap.traceB!.tracePath).toEqual([
    { x: 0, y: -1 },
    { x: 0, y: -0.1 },
    { x: 5, y: -0.1 },
    { x: 5, y: -1 },
  ])
})
