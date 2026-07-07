import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/alignNearbySameNetSegments"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [],
  }) as any

test("alignNearbySameNetSegments aligns close horizontal segments on the same net", () => {
  const traces = alignNearbySameNetSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 0.02 },
      { x: 2, y: 0.02 },
      { x: 2, y: 0 },
    ]),
    makeTrace("b", "net1", [
      { x: 0.5, y: 0.2 },
      { x: 0.5, y: 0.08 },
      { x: 1.5, y: 0.08 },
      { x: 1.5, y: 0.2 },
    ]),
  ])

  expect(traces[0]!.tracePath[1]!.y).toBeCloseTo(0.05)
  expect(traces[0]!.tracePath[2]!.y).toBeCloseTo(0.05)
  expect(traces[1]!.tracePath[1]!.y).toBeCloseTo(0.05)
  expect(traces[1]!.tracePath[2]!.y).toBeCloseTo(0.05)
})

test("alignNearbySameNetSegments does not align different nets", () => {
  const traces = alignNearbySameNetSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 0.02 },
      { x: 2, y: 0.02 },
      { x: 2, y: 0 },
    ]),
    makeTrace("b", "net2", [
      { x: 0.5, y: 0.2 },
      { x: 0.5, y: 0.08 },
      { x: 1.5, y: 0.08 },
      { x: 1.5, y: 0.2 },
    ]),
  ])

  expect(traces[0]!.tracePath[1]!.y).toBe(0.02)
  expect(traces[1]!.tracePath[1]!.y).toBe(0.08)
})
