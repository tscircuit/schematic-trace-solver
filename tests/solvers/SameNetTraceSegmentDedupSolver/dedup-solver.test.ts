import { test, expect, describe } from "bun:test"
import { dedupSameNetTraceSegments } from "lib/solvers/SameNetTraceSegmentDedupSolver/SameNetTraceSegmentDedupSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const p = (x: number, y: number) => ({ x, y })

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    dcConnNetId: globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [],
  }) as unknown as SolvedTracePath

describe("dedupSameNetTraceSegments", () => {
  test("removes exact duplicate reverse-direction trace", () => {
    const traces = [
      makeTrace("a", "VCC", [p(0, 0), p(1, 0)]),
      makeTrace("b", "VCC", [p(1, 0), p(0, 0)]), // exact reverse
    ]

    const result = dedupSameNetTraceSegments(traces)
    expect(result.traces).toHaveLength(1)
    expect(result.traces[0]!.mspPairId).toBe("a")
    expect(result.removedSegments).toBe(1)
  })

  test("removes exact duplicate same-direction trace", () => {
    const traces = [
      makeTrace("a", "VCC", [p(0, 0), p(1, 0)]),
      makeTrace("b", "VCC", [p(0, 0), p(1, 0)]), // exact same
    ]

    const result = dedupSameNetTraceSegments(traces)
    expect(result.traces).toHaveLength(1)
    expect(result.traces[0]!.mspPairId).toBe("a")
  })

  test("does not remove traces from different nets", () => {
    const traces = [
      makeTrace("a", "VCC", [p(0, 0), p(1, 0)]),
      makeTrace("b", "GND", [p(1, 0), p(0, 0)]), // different net
    ]

    const result = dedupSameNetTraceSegments(traces)
    expect(result.traces).toHaveLength(2)
    expect(result.removedSegments).toBe(0)
  })

  test("trims duplicate leading segment", () => {
    const traces = [
      makeTrace("a", "NET1", [p(0, 0), p(1, 0), p(2, 0)]),
      makeTrace("b", "NET1", [p(0, 0), p(1, 0), p(1, 1), p(2, 1)]), // shares 0,0→1,0
    ]

    const result = dedupSameNetTraceSegments(traces)
    expect(result.traces).toHaveLength(2)

    const traceB = result.traces.find((t) => t.mspPairId === "b")!
    expect(traceB.tracePath).toEqual([p(1, 0), p(1, 1), p(2, 1)])
    expect(result.removedSegments).toBe(1)
  })

  test("trims duplicate trailing segment", () => {
    const traces = [
      makeTrace("a", "NET1", [p(1, 1), p(2, 1), p(2, 0)]),
      makeTrace("b", "NET1", [p(0, 0), p(1, 0), p(2, 0)]), // shares 2,0 endpoint via last segment
    ]

    const result = dedupSameNetTraceSegments(traces)
    expect(result.traces).toHaveLength(2)
    // No actual overlapping segment here since segments are different
    // 1,1→2,1 vs 1,0→2,0 — these don't overlap
    expect(result.removedSegments).toBe(0)
  })

  test("skips entirely duplicate trace", () => {
    const traces = [
      makeTrace("a", "NET1", [p(0, 0), p(1, 0)]),
      makeTrace("b", "NET1", [p(0, 0), p(1, 0)]), // entirely duplicate
      makeTrace("c", "NET1", [p(1, 0), p(2, 0)]), // extends from first trace's end
    ]

    const result = dedupSameNetTraceSegments(traces)
    expect(result.traces).toHaveLength(2)
    expect(result.traces.map((t) => t.mspPairId)).toEqual(["a", "c"])
    expect(result.removedSegments).toBe(1)
  })

  test("keeps trace with interior duplicates intact", () => {
    // Two traces that share a middle segment but diverge at start and end
    const traces = [
      makeTrace("a", "NET1", [
        p(0, 0), p(1, 0), p(2, 0), p(3, 0),
      ]),
      makeTrace("b", "NET1", [
        p(0, 1), p(1, 1), p(1, 0), p(2, 0), p(3, 1),
      ]), // shares 1,0→2,0 interior segment
    ]

    const result = dedupSameNetTraceSegments(traces)
    expect(result.traces).toHaveLength(2)
    // Trace b has interior duplicate — kept intact (not trimmed)
    expect(result.traces.find((t) => t.mspPairId === "b")!.tracePath).toEqual(
      [p(0, 1), p(1, 1), p(1, 0), p(2, 0), p(3, 1)],
    )
  })

  test("handles multiple overlapping traces through common pin (DISCH pattern)", () => {
    // U1.7 shared between R1.2→U1.7 and U1.7→R2.1
    const traces = [
      makeTrace("dc3", "DISCH", [
        p(0, 0), p(1, 0), p(2, 0), p(3.05, -1.5),
      ]),
      makeTrace("dc4", "DISCH", [
        p(3.05, -1.5), p(3.935, -1.5), p(5, -1.5),
      ]),
    ]

    const result = dedupSameNetTraceSegments(traces)
    expect(result.traces).toHaveLength(2)
    // No overlapping segments (they only share a point, not a segment)
    expect(result.removedSegments).toBe(0)
  })

  test("handles empty traces array", () => {
    const result = dedupSameNetTraceSegments([])
    expect(result.traces).toHaveLength(0)
    expect(result.removedSegments).toBe(0)
  })

  test("handles trace with single point (no segments)", () => {
    const traces = [
      makeTrace("a", "NET1", [p(0, 0)]),
    ]

    const result = dedupSameNetTraceSegments(traces)
    expect(result.traces).toHaveLength(1)
    expect(result.removedSegments).toBe(0)
  })
})
