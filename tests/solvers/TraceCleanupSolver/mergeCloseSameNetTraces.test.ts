import { describe, expect, test } from "bun:test"
import { mergeCloseSameNetTraces } from "lib/solvers/TraceCleanupSolver/mergeCloseSameNetTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Build a minimal SolvedTracePath stub. The cleanup-pass merge logic only
 * touches `tracePath` and reads `dcConnNetId`, so we don't need the full
 * MspConnectionPair to exercise the behaviour.
 */
const stub = (
  id: string,
  netId: string,
  tracePath: { x: number; y: number }[],
): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    pins: [] as any,
    mspConnectionPairIds: [id],
    pinIds: [],
    tracePath,
  }) as unknown as SolvedTracePath

describe("mergeCloseSameNetTraces", () => {
  test("snaps two same-net horizontal segments offset less than the threshold", () => {
    // Traces must have at least 6 points for a horizontal middle segment to
    // be "interior" — endpoint segments touch pins and are skipped.
    //
    // Trace A: pin (0,0) -> (3,0) -> (3, 4.9) -> (8, 4.9) -> (8, 9) -> pin (12, 9)
    // Trace B: pin (0,0.5) -> (3,0.5) -> (3, 5.1) -> (8, 5.1) -> (8, 9.5) -> pin (12, 9.5)
    //
    // Middle horizontal segments at y=4.9 and y=5.1 are 0.2 apart, same net.
    // With paddingBuffer = 0.5, the default threshold = 0.25, so 0.2 < 0.25
    // and the two segments should snap to the shared midpoint y=5.0.
    const traces = [
      stub("A", "net1", [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 4.9 },
        { x: 8, y: 4.9 },
        { x: 8, y: 9 },
        { x: 12, y: 9 },
      ]),
      stub("B", "net1", [
        { x: 0, y: 0.5 },
        { x: 3, y: 0.5 },
        { x: 3, y: 5.1 },
        { x: 8, y: 5.1 },
        { x: 8, y: 9.5 },
        { x: 12, y: 9.5 },
      ]),
    ]

    const out = mergeCloseSameNetTraces({ traces, paddingBuffer: 0.5 })

    // The middle horizontal segment runs from path[2] to path[3] in both
    // traces; after snap both endpoints sit at y=5.0.
    expect(out[0].tracePath[2].y).toBeCloseTo(5.0, 6)
    expect(out[0].tracePath[3].y).toBeCloseTo(5.0, 6)
    expect(out[1].tracePath[2].y).toBeCloseTo(5.0, 6)
    expect(out[1].tracePath[3].y).toBeCloseTo(5.0, 6)
  })

  test("does NOT snap segments belonging to different nets", () => {
    const traces = [
      stub("A", "net1", [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 4.9 },
        { x: 8, y: 4.9 },
        { x: 8, y: 9 },
        { x: 12, y: 9 },
      ]),
      stub("B", "net2", [
        { x: 0, y: 0.5 },
        { x: 3, y: 0.5 },
        { x: 3, y: 5.1 },
        { x: 8, y: 5.1 },
        { x: 8, y: 9.5 },
        { x: 12, y: 9.5 },
      ]),
    ]

    const out = mergeCloseSameNetTraces({ traces, paddingBuffer: 0.5 })

    // y values of the middle segment should be unchanged.
    expect(out[0].tracePath[2].y).toBeCloseTo(4.9, 6)
    expect(out[1].tracePath[2].y).toBeCloseTo(5.1, 6)
  })

  test("does NOT snap parallel segments that are farther apart than the threshold", () => {
    // Same net, but segments at y=2 and y=8 — way beyond the merge gap.
    const traces = [
      stub("A", "net1", [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 2 },
        { x: 8, y: 2 },
        { x: 8, y: 9 },
        { x: 12, y: 9 },
      ]),
      stub("B", "net1", [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 8 },
        { x: 8, y: 8 },
        { x: 8, y: 9 },
        { x: 12, y: 9 },
      ]),
    ]

    const out = mergeCloseSameNetTraces({ traces, paddingBuffer: 0.5 })

    expect(out[0].tracePath[2].y).toBeCloseTo(2, 6)
    expect(out[1].tracePath[2].y).toBeCloseTo(8, 6)
  })

  test("snaps two same-net vertical segments offset less than the threshold", () => {
    // Vertical analogue: a 6-point trace where path[2]->path[3] is an
    // interior VERTICAL segment.
    //
    // Trace A: pin (0,0) -> (0,3) -> (4.9, 3) -> (4.9, 8) -> (9, 8) -> pin (9, 12)
    // Trace B: pin (0.5,0) -> (0.5,3) -> (5.1, 3) -> (5.1, 8) -> (9.5, 8) -> pin (9.5, 12)
    //
    // The interior vertical segments at x=4.9 and x=5.1 should snap to x=5.0.
    const traces = [
      stub("A", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 3 },
        { x: 4.9, y: 3 },
        { x: 4.9, y: 8 },
        { x: 9, y: 8 },
        { x: 9, y: 12 },
      ]),
      stub("B", "net1", [
        { x: 0.5, y: 0 },
        { x: 0.5, y: 3 },
        { x: 5.1, y: 3 },
        { x: 5.1, y: 8 },
        { x: 9.5, y: 8 },
        { x: 9.5, y: 12 },
      ]),
    ]

    const out = mergeCloseSameNetTraces({ traces, paddingBuffer: 0.5 })

    expect(out[0].tracePath[2].x).toBeCloseTo(5.0, 6)
    expect(out[0].tracePath[3].x).toBeCloseTo(5.0, 6)
    expect(out[1].tracePath[2].x).toBeCloseTo(5.0, 6)
    expect(out[1].tracePath[3].x).toBeCloseTo(5.0, 6)
  })

  test("does not move terminal (pin-touching) endpoints", () => {
    // The first segment of every path connects to a chip pin; moving it
    // would disconnect the trace. Build a case where the boundary segment
    // would be eligible by offset+overlap but is at the path terminus.
    const traces = [
      stub("A", "net1", [
        { x: 0, y: 0.0 },
        { x: 10, y: 0.0 },
      ]),
      stub("B", "net1", [
        { x: 0, y: 0.2 },
        { x: 10, y: 0.2 },
      ]),
    ]

    const out = mergeCloseSameNetTraces({ traces, paddingBuffer: 0.5 })

    // Both endpoints touch pins → no snap.
    expect(out[0].tracePath[0].y).toBe(0.0)
    expect(out[0].tracePath[1].y).toBe(0.0)
    expect(out[1].tracePath[0].y).toBe(0.2)
    expect(out[1].tracePath[1].y).toBe(0.2)
  })

  test("returns inputs unchanged when there is only one trace per net", () => {
    const traces = [
      stub("A", "net1", [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ]),
      stub("B", "net2", [
        { x: 0, y: 1 },
        { x: 5, y: 1 },
      ]),
    ]

    const out = mergeCloseSameNetTraces({ traces, paddingBuffer: 0.5 })
    expect(out[0].tracePath).toEqual(traces[0].tracePath)
    expect(out[1].tracePath).toEqual(traces[1].tracePath)
  })
})
