import { test, expect, describe } from "bun:test"
import {
  MergeSameNetTracesSolver,
  mergeSameNetTraces,
} from "lib/solvers/MergeSameNetTracesSolver/MergeSameNetTracesSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/** Helper to build a minimal SolvedTracePath */
function makeTrace(
  id: string,
  netId: string,
  points: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    tracePath: points,
    mspConnectionPairIds: [id],
    pinIds: [],
    pins: [] as any,
  }
}

describe("mergeSameNetTraces", () => {
  test("merges two horizontal segments on the same Y that touch", () => {
    // Segment A: (0,0) → (2,0)
    // Segment B: (2,0) → (4,0)  — touches A at x=2
    // Expected merged: (0,0) → (4,0) as a single segment in one trace
    const traces = [
      makeTrace("t1", "net1", [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("t2", "net1", [
        { x: 2, y: 0 },
        { x: 4, y: 0 },
      ]),
    ]

    const result = mergeSameNetTraces(traces)

    // After merging, all points should still cover the full range 0→4 on Y=0
    const allPoints = result.flatMap((t) => t.tracePath)
    const xs = allPoints.map((p) => p.x)
    expect(Math.min(...xs)).toBeCloseTo(0)
    expect(Math.max(...xs)).toBeCloseTo(4)

    // All Y values should be 0
    for (const p of allPoints) {
      expect(p.y).toBeCloseTo(0)
    }
  })

  test("merges two overlapping horizontal segments on the same Y", () => {
    // Segment A: (0,1) → (3,1)
    // Segment B: (2,1) → (5,1) — overlaps A in [2,3]
    // Expected merged range: [0,5] on Y=1
    const traces = [
      makeTrace("t1", "net1", [
        { x: 0, y: 1 },
        { x: 3, y: 1 },
      ]),
      makeTrace("t2", "net1", [
        { x: 2, y: 1 },
        { x: 5, y: 1 },
      ]),
    ]

    const result = mergeSameNetTraces(traces)
    const allPoints = result.flatMap((t) => t.tracePath)
    const xs = allPoints.map((p) => p.x)
    expect(Math.min(...xs)).toBeCloseTo(0)
    expect(Math.max(...xs)).toBeCloseTo(5)
  })

  test("merges two vertical segments on the same X that overlap", () => {
    // Segment A: (3,0) → (3,3)
    // Segment B: (3,2) → (3,6) — overlaps in [2,3]
    const traces = [
      makeTrace("t1", "net2", [
        { x: 3, y: 0 },
        { x: 3, y: 3 },
      ]),
      makeTrace("t2", "net2", [
        { x: 3, y: 2 },
        { x: 3, y: 6 },
      ]),
    ]

    const result = mergeSameNetTraces(traces)
    const allPoints = result.flatMap((t) => t.tracePath)
    const ys = allPoints.map((p) => p.y)
    expect(Math.min(...ys)).toBeCloseTo(0)
    expect(Math.max(...ys)).toBeCloseTo(6)
  })

  test("does NOT merge segments that are on different nets", () => {
    // Same axis but different nets — should not be merged
    const traces = [
      makeTrace("t1", "net1", [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("t2", "net2", [
        { x: 2, y: 0 },
        { x: 4, y: 0 },
      ]),
    ]

    const result = mergeSameNetTraces(traces)

    // Both traces should still be present — no cross-net merging
    expect(result).toHaveLength(2)
    expect(result.map((t) => t.mspPairId).sort()).toEqual(["t1", "t2"])
  })

  test("does NOT merge segments that are on the same net but different Y", () => {
    // Parallel horizontal lines on different Y values
    const traces = [
      makeTrace("t1", "net1", [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]),
      makeTrace("t2", "net1", [
        { x: 0, y: 1 },
        { x: 4, y: 1 },
      ]),
    ]

    const result = mergeSameNetTraces(traces)
    expect(result).toHaveLength(2)
  })

  test("preserves a single-trace net unchanged", () => {
    const traces = [
      makeTrace("t1", "net1", [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 3 },
      ]),
    ]

    const result = mergeSameNetTraces(traces)
    expect(result).toHaveLength(1)
    expect(result[0].tracePath).toEqual(traces[0].tracePath)
  })

  test("merges three co-linear segments into one", () => {
    // Three touching horizontal segments covering [0,6] on Y=0
    const traces = [
      makeTrace("t1", "net1", [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("t2", "net1", [
        { x: 2, y: 0 },
        { x: 4, y: 0 },
      ]),
      makeTrace("t3", "net1", [
        { x: 4, y: 0 },
        { x: 6, y: 0 },
      ]),
    ]

    const result = mergeSameNetTraces(traces)
    const allPoints = result.flatMap((t) => t.tracePath)
    const xs = allPoints.map((p) => p.x)
    expect(Math.min(...xs)).toBeCloseTo(0)
    expect(Math.max(...xs)).toBeCloseTo(6)
  })

  test("MergeSameNetTracesSolver class solves correctly", () => {
    const traces = [
      makeTrace("t1", "net1", [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("t2", "net1", [
        { x: 2, y: 0 },
        { x: 4, y: 0 },
      ]),
    ]

    const solver = new MergeSameNetTracesSolver({
      inputProblem: {
        chips: [],
        directConnections: [],
        netConnections: [],
        availableNetLabelOrientations: {},
      },
      inputTraces: traces,
    })

    solver.solve()
    expect(solver.solved).toBe(true)

    const { traces: out } = solver.getOutput()
    const allPoints = out.flatMap((t) => t.tracePath)
    const xs = allPoints.map((p) => p.x)
    expect(Math.min(...xs)).toBeCloseTo(0)
    expect(Math.max(...xs)).toBeCloseTo(4)
  })
})
