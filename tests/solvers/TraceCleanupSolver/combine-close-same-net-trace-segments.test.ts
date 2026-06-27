import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { combineCloseSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/combineCloseSameNetTraceSegments"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [] as any,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [mspPairId],
  }) as SolvedTracePath

test("combines close same-net trace endpoints into one trace", () => {
  const result = combineCloseSameNetTraceSegments(
    [
      makeTrace("A.1-B.1", "net0", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("C.1-D.1", "net0", [
        { x: 1.2, y: 0 },
        { x: 2, y: 0 },
      ]),
    ],
    { maxEndpointDistance: 0.25 },
  )

  expect(result).toHaveLength(1)
  expect(result[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1.2, y: 0 },
    { x: 2, y: 0 },
  ])
  expect(result[0]!.mspConnectionPairIds).toEqual(["A.1-B.1", "C.1-D.1"])
})

test("does not combine close endpoints from different nets", () => {
  const result = combineCloseSameNetTraceSegments(
    [
      makeTrace("A.1-B.1", "net0", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("C.1-D.1", "net1", [
        { x: 1.1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ],
    { maxEndpointDistance: 0.25 },
  )

  expect(result).toHaveLength(2)
})
