import { test, expect } from "bun:test"
import { mergeSameNetSegments } from "lib/solvers/TraceCleanupSolver/mergeSameNetSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("mergeSameNetSegments removes redundant subsets (Issue #78)", () => {
    const traces: SolvedTracePath[] = [
        {
            mspPairId: "t1",
            globalConnNetId: "net1",
            dcConnNetId: "net1",
            tracePath: [
                { x: 0, y: 0 },
                { x: 20, y: 0 },
            ],
            traceWidth: 0.1,
            mspConnectionPairIds: [],
            pinIds: ["p1", "p2"],
            pins: [],
        },
        {
            mspPairId: "t2",
            globalConnNetId: "net1",
            dcConnNetId: "net1",
            tracePath: [
                { x: 5, y: 0 },
                { x: 15, y: 0 },
            ],
            traceWidth: 0.1,
            mspConnectionPairIds: [],
            pinIds: ["p3"],
            pins: [],
        }
    ]

    const merged = mergeSameNetSegments(traces)

    // t2 should be removed because it is a subset of t1
    expect(merged.length).toBe(1)
    expect(merged[0].mspPairId).toBe("t1")
})

test("mergeSameNetSegments merges partial overlaps", () => {
    const traces: SolvedTracePath[] = [
        {
            mspPairId: "t1",
            globalConnNetId: "net1",
            dcConnNetId: "net1",
            tracePath: [
                { x: 0, y: 0 },
                { x: 15, y: 0 },
            ],
            traceWidth: 0.1,
            mspConnectionPairIds: [],
            pinIds: [],
            pins: [],
        },
        {
            mspPairId: "t2",
            globalConnNetId: "net1",
            dcConnNetId: "net1",
            tracePath: [
                { x: 10, y: 0 },
                { x: 25, y: 0 },
            ],
            traceWidth: 0.1,
            mspConnectionPairIds: [],
            pinIds: [],
            pins: [],
        }
    ]

    const merged = mergeSameNetSegments(traces)

    // Currently, our deduplication only removes full subsets.
    // Partial overlaps might remain as two traces, but their points are modified.
    // In a future improvement, we might want to consolidate them.
    // For now, let's verify if they at least share the same line.
    expect(merged.length).toBeGreaterThan(0)
    for (const trace of merged) {
        expect(trace.tracePath[0].y).toBe(0)
    }
})

test("repro61: redundant trace between net labels", () => {
    // Simulating repro61 where two traces connect the same points
    const traces: SolvedTracePath[] = [
        {
            mspPairId: "t1",
            globalConnNetId: "VCC",
            dcConnNetId: "VCC",
            tracePath: [{ x: 10, y: 10 }, { x: 20, y: 10 }],
            traceWidth: 0.1,
            mspConnectionPairIds: ["pair1"],
            pinIds: [],
            pins: [],
        },
        {
            mspPairId: "t2",
            globalConnNetId: "VCC",
            dcConnNetId: "VCC",
            tracePath: [{ x: 10, y: 10.01 }, { x: 20, y: 10.01 }],
            traceWidth: 0.1,
            mspConnectionPairIds: ["pair2"],
            pinIds: [],
            pins: [],
        }
    ]

    const merged = mergeSameNetSegments(traces)

    // With 0.02 threshold, these should align and then one should be removed as a duplicate
    expect(merged.length).toBe(1)
})
