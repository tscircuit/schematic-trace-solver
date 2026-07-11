import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { combineSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/combineSameNetTraceSegments"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [] as any,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    tracePath,
  }) as SolvedTracePath

test("combines close overlapping same-net internal horizontal segments", () => {
  const [traceA, traceB] = combineSameNetTraceSegments({
    traces: [
      makeTrace("trace-a", "net-1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
        { x: 5, y: 0 },
      ]),
      makeTrace("trace-b", "net-1", [
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 1, y: 1.05 },
        { x: 4, y: 1.05 },
        { x: 4, y: 2 },
        { x: 5, y: 2 },
      ]),
    ],
    inputProblem,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    maxDistance: 0.1,
  })

  expect(traceA!.tracePath[2]!.y).toBe(1)
  expect(traceA!.tracePath[3]!.y).toBe(1)
  expect(traceB!.tracePath[2]!.y).toBe(1)
  expect(traceB!.tracePath[3]!.y).toBe(1)
})

test("does not combine close segments from different nets", () => {
  const [, traceB] = combineSameNetTraceSegments({
    traces: [
      makeTrace("trace-a", "net-1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
        { x: 5, y: 0 },
      ]),
      makeTrace("trace-b", "net-2", [
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 1, y: 1.05 },
        { x: 4, y: 1.05 },
        { x: 4, y: 2 },
        { x: 5, y: 2 },
      ]),
    ],
    inputProblem,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    maxDistance: 0.1,
  })

  expect(traceB!.tracePath[2]!.y).toBe(1.05)
  expect(traceB!.tracePath[3]!.y).toBe(1.05)
})

test("leaves endpoint-only traces anchored to their pins", () => {
  const [traceA, traceB] = combineSameNetTraceSegments({
    traces: [
      makeTrace("trace-a", "net-1", [
        { x: 0, y: 1 },
        { x: 4, y: 1 },
      ]),
      makeTrace("trace-b", "net-1", [
        { x: 0, y: 1.05 },
        { x: 4, y: 1.05 },
      ]),
    ],
    inputProblem,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    maxDistance: 0.1,
  })

  expect(traceA!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 4, y: 1 },
  ])
  expect(traceB!.tracePath).toEqual([
    { x: 0, y: 1.05 },
    { x: 4, y: 1.05 },
  ])
})
