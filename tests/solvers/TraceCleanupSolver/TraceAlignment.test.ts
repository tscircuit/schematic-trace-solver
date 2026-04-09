import { test, expect } from "bun:test"
import { mergeSameNetSegments } from "lib/solvers/TraceCleanupSolver/mergeSameNetSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("mergeSameNetSegments aligns close traces (Issue #34)", () => {
    const traces: SolvedTracePath[] = [
        {
            mspPairId: "t1",
            globalConnNetId: "net1",
            dcConnNetId: "net1",
            tracePath: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
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
                { x: 1, y: 0.015 },
                { x: 2, y: 0.015 },
            ],
            traceWidth: 0.1,
            mspConnectionPairIds: [],
            pinIds: [],
            pins: [],
        }
    ]

    const merged = mergeSameNetSegments(traces)

    // Expected: both at average Y = 0.0075
    // But note: mergeSameNetSegments modifies points in-place and might deduplicate.
    // The current deduplication check uses a tighter 0.001 threshold for comparison.
    
    expect(merged.length).toBeGreaterThan(0)
    for (const trace of merged) {
        for (const p of trace.tracePath) {
            expect(p.y).toBeCloseTo(0.0075, 5)
        }
    }
})

test("mergeSameNetSegments should NOT align traces outside threshold", () => {
    const traces: SolvedTracePath[] = [
        {
            mspPairId: "t1",
            globalConnNetId: "net1",
            dcConnNetId: "net1",
            tracePath: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
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
                { x: 0.5, y: 0.05 },
                { x: 1.5, y: 0.05 },
            ],
            traceWidth: 0.1,
            mspConnectionPairIds: [],
            pinIds: [],
            pins: [],
        }
    ]

    const merged = mergeSameNetSegments(traces)

    expect(merged.length).toBe(2)
    expect(merged.find(t => t.mspPairId === "t1")?.tracePath[0].y).toBe(0)
    expect(merged.find(t => t.mspPairId === "t2")?.tracePath[0].y).toBe(0.05)
})
