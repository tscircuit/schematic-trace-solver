import { test, expect } from "bun:test"
import { mergeSameNetCollinearSegments } from "lib/solvers/TraceCleanupSolver/mergeSameNetCollinearSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  netId: string,
  points: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: netId,
    globalConnNetId: netId,
    userNetId: netId,
    pins: [
      { pinId: `${mspPairId}-a`, x: points[0]!.x, y: points[0]!.y, chipId: "c1" },
      {
        pinId: `${mspPairId}-b`,
        x: points[points.length - 1]!.x,
        y: points[points.length - 1]!.y,
        chipId: "c2",
      },
    ],
    tracePath: points,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}-a`, `${mspPairId}-b`],
  }) as SolvedTracePath

test("snaps nearby horizontal segments on same net", () => {
  const traces = [
    makeTrace("p1-p2", "N1", [
      { x: 0, y: 1 },
      { x: 2, y: 1 },
    ]),
    makeTrace("p3-p4", "N1", [
      { x: 1, y: 1.06 },
      { x: 4, y: 1.06 },
    ]),
  ]

  const out = mergeSameNetCollinearSegments(traces)

  expect(out[0]!.tracePath[0]!.y).toBeCloseTo(1.03, 5)
  expect(out[0]!.tracePath[1]!.y).toBeCloseTo(1.03, 5)
  expect(out[1]!.tracePath[0]!.y).toBeCloseTo(1.03, 5)
  expect(out[1]!.tracePath[1]!.y).toBeCloseTo(1.03, 5)
})

test("does not snap segments from different nets", () => {
  const traces = [
    makeTrace("p1-p2", "N1", [
      { x: 0, y: 2 },
      { x: 2, y: 2 },
    ]),
    makeTrace("p3-p4", "N2", [
      { x: 1, y: 2.05 },
      { x: 4, y: 2.05 },
    ]),
  ]

  const out = mergeSameNetCollinearSegments(traces)

  expect(out[0]!.tracePath[0]!.y).toBeCloseTo(2, 5)
  expect(out[1]!.tracePath[0]!.y).toBeCloseTo(2.05, 5)
})

test("removes middle point after segment snap creates collinearity", () => {
  const traces = [
    makeTrace("p1-p2", "N3", [
      { x: 0, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ]),
    makeTrace("p3-p4", "N3", [
      { x: 0, y: 2 },
      { x: 2, y: 2 },
    ]),
  ]

  const out = mergeSameNetCollinearSegments(traces, {
    coordinateSnapTolerance: 1.2,
  })

  expect(out[0]!.tracePath).toEqual([
    { x: 0, y: 1.5 },
    { x: 2, y: 2 },
  ])
})
