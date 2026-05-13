import { describe, expect, test } from "bun:test"
import { mergeCollinearTraces } from "lib/solvers/TraceCleanupSolver/mergeCollinearTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Helper to create a minimal SolvedTracePath for testing.
 */
function makeTrace(overrides: Partial<SolvedTracePath> = {}): SolvedTracePath {
  return {
    mspPairId: "pair-1",
    dcConnNetId: "dc-net-1",
    globalConnNetId: "global-net-1",
    userNetId: undefined,
    pins: [
      { pinId: "pin-a", x: 0, y: 0, chipId: "chip-1" },
      { pinId: "pin-b", x: 0, y: 0, chipId: "chip-2" },
    ],
    tracePath: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    mspConnectionPairIds: ["msp-1"],
    pinIds: ["pin-a", "pin-b"],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Basic merge / no-merge behaviour
// ---------------------------------------------------------------------------

describe("mergeCollinearTraces", () => {
  test("merges two horizontal collinear traces on the same net", () => {
    const t1 = makeTrace({
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
      mspConnectionPairIds: ["msp-1"],
      pinIds: ["pin-a", "pin-b"],
    })
    const t2 = makeTrace({
      tracePath: [
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ],
      mspConnectionPairIds: ["msp-2"],
      pinIds: ["pin-c", "pin-d"],
    })

    const result = mergeCollinearTraces([t1, t2])
    expect(result).toHaveLength(1)
    const path = result[0]!.tracePath
    expect(path[0]!.x).toBe(0)
    expect(path[1]!.x).toBe(10)

    // Merged arrays should be de-duplicated and contain all ids
    expect(result[0]!.mspConnectionPairIds).toContain("msp-1")
    expect(result[0]!.mspConnectionPairIds).toContain("msp-2")
    expect(result[0]!.pinIds).toContain("pin-a")
    expect(result[0]!.pinIds).toContain("pin-d")
  })

  test("merges two vertical collinear traces on the same net", () => {
    const t1 = makeTrace({
      tracePath: [
        { x: 10, y: 0 },
        { x: 10, y: 5 },
      ],
    })
    const t2 = makeTrace({
      tracePath: [
        { x: 10, y: 5 },
        { x: 10, y: 10 },
      ],
    })

    const result = mergeCollinearTraces([t1, t2])
    expect(result).toHaveLength(1)
    expect(result[0]!.tracePath).toEqual([
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ])
  })

  test("does not merge traces on different globalConnNetId", () => {
    const t1 = makeTrace({
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
      globalConnNetId: "net-A",
    })
    const t2 = makeTrace({
      tracePath: [
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ],
      globalConnNetId: "net-B",
    })

    const result = mergeCollinearTraces([t1, t2])
    expect(result).toHaveLength(2)
  })

  test("does not merge non-collinear traces", () => {
    const t1 = makeTrace({
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ], // horizontal
    })
    const t2 = makeTrace({
      tracePath: [
        { x: 5, y: 0 },
        { x: 5, y: 5 },
      ], // vertical
    })

    const result = mergeCollinearTraces([t1, t2])
    // Both are simple 2-point segments but not same orientation — no merge
    expect(result).toHaveLength(2)
  })

  test("merges three consecutive horizontal traces", () => {
    const t1 = makeTrace({
      tracePath: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ],
      mspConnectionPairIds: ["msp-1"],
      pinIds: ["a", "b"],
    })
    const t2 = makeTrace({
      tracePath: [
        { x: 3, y: 0 },
        { x: 6, y: 0 },
      ],
      mspConnectionPairIds: ["msp-2"],
      pinIds: ["c", "d"],
    })
    const t3 = makeTrace({
      tracePath: [
        { x: 6, y: 0 },
        { x: 10, y: 0 },
      ],
      mspConnectionPairIds: ["msp-3"],
      pinIds: ["e", "f"],
    })

    const result = mergeCollinearTraces([t1, t2, t3])
    expect(result).toHaveLength(1)
    expect(result[0]!.tracePath).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ])
    expect(result[0]!.mspConnectionPairIds.length).toBe(3)
    expect(result[0]!.pinIds.length).toBe(6)
  })

  test("handles close but not touching segments (within threshold)", () => {
    const t1 = makeTrace({
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
    })
    const t2 = makeTrace({
      tracePath: [
        { x: 5.03, y: 0 },
        { x: 10, y: 0 },
      ],
    })

    // Default threshold is 0.05, so 0.03 gap should merge
    const result = mergeCollinearTraces([t1, t2])
    expect(result).toHaveLength(1)
    expect(result[0]!.tracePath[1]!.x).toBe(10)
  })

  // -----------------------------------------------------------------------
  // Issue-specific reproduction cases
  // -----------------------------------------------------------------------

  test("Issue #34: merges three fragmented collinear segments", () => {
    const t1 = makeTrace({
      tracePath: [
        { x: 0, y: 2 },
        { x: 2, y: 2 },
      ],
      globalConnNetId: "net-34",
    })
    const t2 = makeTrace({
      tracePath: [
        { x: 2.02, y: 2 },
        { x: 4, y: 2 },
      ],
      globalConnNetId: "net-34",
    })
    const t3 = makeTrace({
      tracePath: [
        { x: 4.01, y: 2 },
        { x: 6, y: 2 },
      ],
      globalConnNetId: "net-34",
    })

    const result = mergeCollinearTraces([t1, t2, t3])
    expect(result).toHaveLength(1)
    expect(result[0]!.tracePath).toEqual([
      { x: 0, y: 2 },
      { x: 6, y: 2 },
    ])
  })

  test("Issue #29: merges overlapping collinear segments on same net", () => {
    const t1 = makeTrace({
      tracePath: [
        { x: 0, y: 5 },
        { x: 5, y: 5 },
      ],
      globalConnNetId: "net-29",
    })
    const t2 = makeTrace({
      tracePath: [
        { x: 3, y: 5 },
        { x: 8, y: 5 },
      ],
      globalConnNetId: "net-29",
    })

    const result = mergeCollinearTraces([t1, t2])
    expect(result).toHaveLength(1)
    expect(result[0]!.tracePath).toEqual([
      { x: 0, y: 5 },
      { x: 8, y: 5 },
    ])
  })

  // -----------------------------------------------------------------------
  // Metadata preservation & de-duplication
  // -----------------------------------------------------------------------

  test("de-duplicates mspConnectionPairIds in merged result", () => {
    const t1 = makeTrace({
      tracePath: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ],
      mspConnectionPairIds: ["msp-1", "msp-2"],
      pinIds: ["pin-a", "pin-b"],
    })
    const t2 = makeTrace({
      tracePath: [
        { x: 3, y: 0 },
        { x: 6, y: 0 },
      ],
      mspConnectionPairIds: ["msp-2", "msp-3"],
      pinIds: ["pin-b", "pin-c"],
    })

    const result = mergeCollinearTraces([t1, t2])
    expect(result).toHaveLength(1)
    // "msp-2" appears in both -> must not appear twice
    expect(result[0]!.mspConnectionPairIds).toEqual(
      expect.arrayContaining(["msp-1", "msp-2", "msp-3"]),
    )
    expect(result[0]!.mspConnectionPairIds.length).toBe(3)

    // "pin-b" appears in both -> must not appear twice
    expect(result[0]!.pinIds).toEqual(
      expect.arrayContaining(["pin-a", "pin-b", "pin-c"]),
    )
    expect(result[0]!.pinIds.length).toBe(3)
  })

  test("preserves per-pair metadata in absorbed trace (in-place update)", () => {
    // When two traces merge, the absorbed trace should be updated in-place
    // so downstream solvers that hold references see the unified path.
    const t1 = makeTrace({
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
      mspConnectionPairIds: ["msp-a"],
      pinIds: ["p1"],
    })
    const t2 = makeTrace({
      tracePath: [
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ],
      mspConnectionPairIds: ["msp-b"],
      pinIds: ["p2"],
    })

    // Hold a reference to t2 before merging
    const t2Ref = t2
    const result = mergeCollinearTraces([t1, t2])

    expect(result).toHaveLength(1)

    // The downstream reference should reflect the unified path
    expect(t2Ref.tracePath).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ])
    expect(t2Ref.mspConnectionPairIds).toContain("msp-a")
    expect(t2Ref.mspConnectionPairIds).toContain("msp-b")
    expect(t2Ref.pinIds).toContain("p1")
    expect(t2Ref.pinIds).toContain("p2")
  })

  // -----------------------------------------------------------------------
  // Net matching: globalConnNetId primary, userNetId compatibility
  // -----------------------------------------------------------------------

  test("does not merge when both traces have different userNetId", () => {
    const t1 = makeTrace({
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
      globalConnNetId: "net-same",
      userNetId: "user-A",
    })
    const t2 = makeTrace({
      tracePath: [
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ],
      globalConnNetId: "net-same",
      userNetId: "user-B",
    })

    const result = mergeCollinearTraces([t1, t2])
    expect(result).toHaveLength(2)
  })

  test("merges when both traces have the same userNetId", () => {
    const t1 = makeTrace({
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
      globalConnNetId: "net-same",
      userNetId: "user-A",
    })
    const t2 = makeTrace({
      tracePath: [
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ],
      globalConnNetId: "net-same",
      userNetId: "user-A",
    })

    const result = mergeCollinearTraces([t1, t2])
    expect(result).toHaveLength(1)
  })

  test("merges when only one trace has userNetId defined", () => {
    const t1 = makeTrace({
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
      globalConnNetId: "net-same",
      userNetId: undefined,
    })
    const t2 = makeTrace({
      tracePath: [
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ],
      globalConnNetId: "net-same",
      userNetId: "user-A",
    })

    const result = mergeCollinearTraces([t1, t2])
    expect(result).toHaveLength(1)
  })

  // -----------------------------------------------------------------------
  // Threshold boundary tests
  // -----------------------------------------------------------------------

  test("does not merge segments beyond 0.05 threshold", () => {
    const t1 = makeTrace({
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
    })
    const t2 = makeTrace({
      tracePath: [
        { x: 5.06, y: 0 },
        { x: 10, y: 0 },
      ],
    })

    // Default threshold is 0.05, so 0.06 gap should NOT merge
    const result = mergeCollinearTraces([t1, t2])
    expect(result).toHaveLength(2)
  })

  test("does not merge segments on different horizontal lines beyond threshold", () => {
    const t1 = makeTrace({
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
    })
    const t2 = makeTrace({
      tracePath: [
        { x: 5, y: 0.06 },
        { x: 10, y: 0.06 },
      ],
    })

    const result = mergeCollinearTraces([t1, t2])
    expect(result).toHaveLength(2)
  })

  // -----------------------------------------------------------------------
  // Complex trace handling (non-2-point traces are preserved as-is)
  // -----------------------------------------------------------------------

  test("preserves complex (L-shaped) traces without modification", () => {
    const simple = makeTrace({
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
    })
    const complex = makeTrace({
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 },
      ],
    })

    const result = mergeCollinearTraces([simple, complex])
    // Simple stays, complex passes through
    expect(result).toHaveLength(2)
    // Complex trace path unchanged
    const complexResult = result.find((t) => t.tracePath.length === 3)
    expect(complexResult!.tracePath).toHaveLength(3)
  })

  test("simplifies trace with multiple collinear points", () => {
    const trace = makeTrace({
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
    })

    const result = mergeCollinearTraces([trace])
    expect(result).toHaveLength(1)
    // Should simplify to just two endpoints
    expect(result[0]!.tracePath).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ])
  })

  test("returns empty array when given empty input", () => {
    const result = mergeCollinearTraces([])
    expect(result).toEqual([])
  })
})
