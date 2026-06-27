import { describe, expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeCollinearTraces } from "lib/utils/merge-collinear-traces"

/**
 * Helper to build a minimal SolvedTracePath for testing.
 */
function makeTrace(
  id: string,
  globalConnNetId: string,
  points: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [] as any,
    mspConnectionPairIds: [id],
    pinIds: [],
    tracePath: points,
  }
}

describe("mergeCollinearTraces", () => {
  test("does not merge traces from different nets", () => {
    const traces = [
      makeTrace("A", "net1", [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("B", "net2", [
        { x: 1, y: 0 },
        { x: 3, y: 0 },
      ]),
    ]

    const result = mergeCollinearTraces(traces)

    // Both traces should be kept unchanged since they are on different nets.
    expect(result).toHaveLength(2)
  })

  test("merges two overlapping horizontal segments on the same net", () => {
    // net1: trace A goes from x=0 to x=2 at y=0
    //       trace B goes from x=1 to x=3 at y=0   (overlaps A by [1..2])
    // Expected: A is extended to [0..3], B is removed.
    const traces = [
      makeTrace("A", "net1", [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("B", "net1", [
        { x: 1, y: 0 },
        { x: 3, y: 0 },
      ]),
    ]

    const result = mergeCollinearTraces(traces)

    expect(result).toHaveLength(1)
    const path = result[0]!.tracePath
    expect(path).toHaveLength(2)
    // Merged interval is [0, 3] at y=0
    const xs = path.map((p) => p.x).sort((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(0)
    expect(xs[1]).toBeCloseTo(3)
    expect(path.every((p) => Math.abs(p.y) < 1e-6)).toBe(true)
  })

  test("merges two adjacent (touching) horizontal segments on the same net", () => {
    // net1: trace A goes from x=0 to x=1 at y=0
    //       trace B goes from x=1 to x=2 at y=0  (touches A at x=1)
    const traces = [
      makeTrace("A", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("B", "net1", [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ]

    const result = mergeCollinearTraces(traces)

    expect(result).toHaveLength(1)
    const path = result[0]!.tracePath
    const xs = path.map((p) => p.x).sort((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(0)
    expect(xs[1]).toBeCloseTo(2)
  })

  test("merges two overlapping vertical segments on the same net", () => {
    // net1: trace A goes from y=0 to y=2 at x=0
    //       trace B goes from y=1 to y=3 at x=0   (overlaps)
    const traces = [
      makeTrace("A", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 2 },
      ]),
      makeTrace("B", "net1", [
        { x: 0, y: 1 },
        { x: 0, y: 3 },
      ]),
    ]

    const result = mergeCollinearTraces(traces)

    expect(result).toHaveLength(1)
    const path = result[0]!.tracePath
    const ys = path.map((p) => p.y).sort((a, b) => a - b)
    expect(ys[0]).toBeCloseTo(0)
    expect(ys[1]).toBeCloseTo(3)
    expect(path.every((p) => Math.abs(p.x) < 1e-6)).toBe(true)
  })

  test("keeps non-collinear same-net traces separate", () => {
    // Two traces on the same net but at different Y values — should not merge.
    const traces = [
      makeTrace("A", "net1", [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("B", "net1", [
        { x: 0, y: 1 },
        { x: 2, y: 1 },
      ]),
    ]

    const result = mergeCollinearTraces(traces)

    expect(result).toHaveLength(2)
  })

  test("handles three overlapping segments — merges all into one", () => {
    // net1: A=[0..2], B=[1..3], C=[2..4] all at y=0
    const traces = [
      makeTrace("A", "net1", [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("B", "net1", [
        { x: 1, y: 0 },
        { x: 3, y: 0 },
      ]),
      makeTrace("C", "net1", [
        { x: 2, y: 0 },
        { x: 4, y: 0 },
      ]),
    ]

    const result = mergeCollinearTraces(traces)

    expect(result).toHaveLength(1)
    const path = result[0]!.tracePath
    const xs = path.map((p) => p.x).sort((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(0)
    expect(xs[1]).toBeCloseTo(4)
  })

  test("multi-segment trace: only the overlapping segment is shortened", () => {
    // Trace A: L-shape going right then down  (two segments)
    // Trace B: short horizontal segment that overlaps the horizontal part of A
    // After merge: A's horizontal segment is extended to cover B, B is removed.
    const traces = [
      makeTrace("A", "net1", [
        { x: 0, y: 0 },
        { x: 3, y: 0 }, // horizontal segment at y=0 from x=0 to x=3
        { x: 3, y: -2 }, // vertical segment going down
      ]),
      makeTrace("B", "net1", [
        { x: 2, y: 0 },
        { x: 5, y: 0 }, // overlaps A's horizontal segment
      ]),
    ]

    const result = mergeCollinearTraces(traces)

    // B should be absorbed; A extended.
    expect(result).toHaveLength(1)
    const path = result[0]!.tracePath
    // Find the horizontal part (y=0 points)
    const horizontalPts = path.filter((p) => Math.abs(p.y) < 1e-6)
    const xs = horizontalPts.map((p) => p.x).sort((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(0)
    expect(xs[xs.length - 1]).toBeCloseTo(5)
  })

  test("pipeline integration: collinear L-shape traces on same net are merged", () => {
    // Two GND L-shape traces whose horizontal portions at y=-2 overlap/touch.
    // pair-1: vertical from (x=-1,y=-1) down to (x=-1,y=-2), then horizontal to (x=0,y=-2)
    // pair-2: vertical from (x=1,y=-1) down to (x=1,y=-2), then horizontal to (x=0,y=-2)
    // Both horizontal segments share y=-2 and touch/overlap at x=0.
    const rawTraces = [
      makeTrace("pair-1", "GND", [
        { x: -1, y: -1 },
        { x: -1, y: -2 },
        { x: 0, y: -2 },
      ]),
      makeTrace("pair-2", "GND", [
        { x: 1, y: -1 },
        { x: 1, y: -2 },
        { x: 0, y: -2 },
      ]),
    ]

    const merged = mergeCollinearTraces(rawTraces)

    // After merge, the horizontal segments at y=-2 should be unified into a
    // single segment spanning [-1..1].  One trace owns the full horizontal
    // range; the other retains only its vertical stub.
    const horizontalSegments = merged.flatMap((t) => {
      const segs: Array<{ x1: number; x2: number }> = []
      for (let i = 0; i < t.tracePath.length - 1; i++) {
        const p1 = t.tracePath[i]!
        const p2 = t.tracePath[i + 1]!
        if (Math.abs(p1.y - p2.y) < 1e-6 && Math.abs(p1.y - -2) < 1e-6) {
          segs.push({ x1: Math.min(p1.x, p2.x), x2: Math.max(p1.x, p2.x) })
        }
      }
      return segs
    })

    // There should be exactly one merged horizontal segment spanning x=[-1..1].
    expect(horizontalSegments).toHaveLength(1)
    expect(horizontalSegments[0]!.x1).toBeCloseTo(-1)
    expect(horizontalSegments[0]!.x2).toBeCloseTo(1)
  })
})
