import { describe, it, expect } from "vitest"  // This will work with Bun's test runner
import { mergeCloseParallelSegments } from "lib/utils/mergeCloseParallelSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"


const makeTrace = (
  id: string,
  netId: string,
  pts: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    tracePath: pts,
    pins: [] as any,
    mspConnectionPairIds: [id],
    pinIds: [],
    userNetId: undefined,
  } as any)

describe("mergeCloseParallelSegments", () => {
  it("snaps two close horizontal same-net segments to same Y", () => {
    const traces = [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 0, y: 0.05 },
        { x: 1, y: 0.05 },
      ]),
    ]
    const result = mergeCloseParallelSegments(traces, 0.1)
    const midY = 0.025
    for (const t of result) {
      expect(t.tracePath[0]!.y).toBeCloseTo(midY)
      expect(t.tracePath[1]!.y).toBeCloseTo(midY)
    }
  })

  it("snaps two close vertical same-net segments to same X", () => {
    const traces = [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ]),
      makeTrace("b", "net1", [
        { x: 0.04, y: 0 },
        { x: 0.04, y: 1 },
      ]),
    ]
    const result = mergeCloseParallelSegments(traces, 0.1)
    const midX = 0.02
    for (const t of result) {
      expect(t.tracePath[0]!.x).toBeCloseTo(midX)
      expect(t.tracePath[1]!.x).toBeCloseTo(midX)
    }
  })

  it("does NOT merge segments on different nets", () => {
    const traces = [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("b", "net2", [
        { x: 0, y: 0.05 },
        { x: 1, y: 0.05 },
      ]),
    ]
    const result = mergeCloseParallelSegments(traces, 0.1)
    expect(result[0]!.tracePath[0]!.y).toBeCloseTo(0)
    expect(result[1]!.tracePath[0]!.y).toBeCloseTo(0.05)
  })

  it("does NOT merge segments farther than threshold", () => {
    const traces = [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 0, y: 0.5 },
        { x: 1, y: 0.5 },
      ]),
    ]
    const result = mergeCloseParallelSegments(traces, 0.1)
    expect(result[0]!.tracePath[0]!.y).toBeCloseTo(0)
    expect(result[1]!.tracePath[0]!.y).toBeCloseTo(0.5)
  })

  it("does NOT merge non-overlapping segments on same Y", () => {
    const traces = [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 2, y: 0.05 },
        { x: 3, y: 0.05 },
      ]),
    ]
    const result = mergeCloseParallelSegments(traces, 0.1)
    expect(result[0]!.tracePath[0]!.y).toBeCloseTo(0)
    expect(result[1]!.tracePath[0]!.y).toBeCloseTo(0.05)
  })
})