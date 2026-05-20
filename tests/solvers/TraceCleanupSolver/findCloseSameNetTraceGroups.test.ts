import { expect, test } from "bun:test"
import { findCloseSameNetTraceGroups } from "lib/solvers/TraceCleanupSolver/sub-solver/findCloseSameNetTraceGroups"

const trace = (
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
) =>
  ({
    mspPairId: id,
    userNetId: netId,
    globalConnNetId: `${netId}-global`,
    dcConnNetId: `${netId}-dc`,
    tracePath: path,
  }) as any

test("findCloseSameNetTraceGroups groups close same-net traces by endpoint distance", () => {
  const groups = findCloseSameNetTraceGroups(
    [
      trace("a", "N1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      trace("b", "N1", [
        { x: 1.15, y: 0 },
        { x: 2, y: 0 },
      ]),
      trace("c", "N2", [
        { x: 10, y: 10 },
        { x: 11, y: 10 },
      ]),
    ],
    0.2,
  )

  expect(groups).toHaveLength(1)
  expect(groups[0].netId).toBe("N1")
  expect(groups[0].traceIds).toEqual(["a", "b"])
  expect(groups[0].maxEndpointDistance).toBeLessThanOrEqual(0.2)
})
