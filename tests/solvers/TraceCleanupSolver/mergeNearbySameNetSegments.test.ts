import { expect, test } from "bun:test"
import { mergeNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/mergeNearbySameNetSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

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
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    tracePath,
  }) as any

test("mergeNearbySameNetSegments aligns close overlapping horizontal same-net segments", () => {
  const [a, b] = mergeNearbySameNetSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ]),
    makeTrace("b", "net1", [
      { x: 1, y: 0 },
      { x: 1, y: 1.1 },
      { x: 4, y: 1.1 },
      { x: 4, y: 2 },
    ]),
  ])

  expect(a.tracePath[1]!.y).toBeCloseTo(1.05)
  expect(a.tracePath[2]!.y).toBeCloseTo(1.05)
  expect(b.tracePath[1]!.y).toBeCloseTo(1.05)
  expect(b.tracePath[2]!.y).toBeCloseTo(1.05)
})

test("mergeNearbySameNetSegments does not align different-net segments", () => {
  const [a, b] = mergeNearbySameNetSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ]),
    makeTrace("b", "net2", [
      { x: 1, y: 0 },
      { x: 1, y: 1.1 },
      { x: 4, y: 1.1 },
      { x: 4, y: 2 },
    ]),
  ])

  expect(a.tracePath[1]!.y).toBe(1)
  expect(b.tracePath[1]!.y).toBe(1.1)
})
