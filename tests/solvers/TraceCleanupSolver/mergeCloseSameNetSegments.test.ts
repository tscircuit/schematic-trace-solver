import { describe, expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeCloseSameNetSegments } from "lib/solvers/TraceCleanupSolver/mergeCloseSameNetSegments"

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
    pinIds: [],
  }) as unknown as SolvedTracePath

describe("mergeCloseSameNetSegments", () => {
  test("merges close horizontal internal segments on the same net", () => {
    const traces = [
      makeTrace("a", "N1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "N1", [
        { x: 0, y: 0.08 },
        { x: 0, y: 1.08 },
        { x: 4, y: 1.08 },
        { x: 4, y: 0.08 },
      ]),
    ]

    const result = mergeCloseSameNetSegments(traces)

    expect(result[0]!.tracePath[1]!.y).toBeCloseTo(1.04, 6)
    expect(result[0]!.tracePath[2]!.y).toBeCloseTo(1.04, 6)
    expect(result[1]!.tracePath[1]!.y).toBeCloseTo(1.04, 6)
    expect(result[1]!.tracePath[2]!.y).toBeCloseTo(1.04, 6)
  })

  test("merges close vertical internal segments on the same net", () => {
    const traces = [
      makeTrace("a", "N1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 4 },
        { x: 0, y: 4 },
      ]),
      makeTrace("b", "N1", [
        { x: 0.08, y: 0 },
        { x: 1.08, y: 0 },
        { x: 1.08, y: 4 },
        { x: 0.08, y: 4 },
      ]),
    ]

    const result = mergeCloseSameNetSegments(traces)

    expect(result[0]!.tracePath[1]!.x).toBeCloseTo(1.04, 6)
    expect(result[0]!.tracePath[2]!.x).toBeCloseTo(1.04, 6)
    expect(result[1]!.tracePath[1]!.x).toBeCloseTo(1.04, 6)
    expect(result[1]!.tracePath[2]!.x).toBeCloseTo(1.04, 6)
  })

  test("does not merge segments from different nets", () => {
    const traces = [
      makeTrace("a", "N1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "N2", [
        { x: 0, y: 0.08 },
        { x: 0, y: 1.08 },
        { x: 4, y: 1.08 },
        { x: 4, y: 0.08 },
      ]),
    ]

    const result = mergeCloseSameNetSegments(traces)

    expect(result[0]!.tracePath[1]!.y).toBe(1)
    expect(result[1]!.tracePath[1]!.y).toBe(1.08)
  })

  test("does not merge when distance exceeds threshold", () => {
    const traces = [
      makeTrace("a", "N1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "N1", [
        { x: 0, y: 0.4 },
        { x: 0, y: 1.4 },
        { x: 4, y: 1.4 },
        { x: 4, y: 0.4 },
      ]),
    ]

    const result = mergeCloseSameNetSegments(traces)

    expect(result[0]!.tracePath[1]!.y).toBe(1)
    expect(result[1]!.tracePath[1]!.y).toBe(1.4)
  })

  test("does not merge non-overlapping parallel segments", () => {
    const traces = [
      makeTrace("a", "N1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 0 },
      ]),
      makeTrace("b", "N1", [
        { x: 3, y: 0.08 },
        { x: 3, y: 1.08 },
        { x: 5, y: 1.08 },
        { x: 5, y: 0.08 },
      ]),
    ]

    const result = mergeCloseSameNetSegments(traces)

    expect(result[0]!.tracePath[1]!.y).toBe(1)
    expect(result[1]!.tracePath[1]!.y).toBe(1.08)
  })
})
