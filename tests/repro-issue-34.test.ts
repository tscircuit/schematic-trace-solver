import { expect, test, describe } from "bun:test"
import { mergeCollinearTraces } from "lib/solvers/TraceCleanupSolver/mergeCollinearTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

describe("Issue #34: Fragmented same-net trace lines", () => {
    test("should merge three collinear horizontal trace segments into a single line", () => {
        /**
         * Issue #34 Reproduction:
         * Three trace segments on the same net that are collinear and should be merged:
         * - Segment 1: (0, 0) to (2, 0)
         * - Segment 2: (2, 0) to (5, 0)
         * - Segment 3: (5, 0) to (10, 0)
         *
         * Expected result: Single trace from (0, 0) to (10, 0)
         */
        const traces: SolvedTracePath[] = [
            {
                mspPairId: "trace1",
                dcConnNetId: "SIGNAL",
                globalConnNetId: "SIGNAL",
                userNetId: "SIGNAL",
                tracePath: [
                    { x: 0, y: 0 },
                    { x: 2, y: 0 },
                ],
                mspConnectionPairIds: ["pair1"],
                pinIds: ["U1.1", "intermediate1"],
                pins: [] as any,
            },
            {
                mspPairId: "trace2",
                dcConnNetId: "SIGNAL",
                globalConnNetId: "SIGNAL",
                userNetId: "SIGNAL",
                tracePath: [
                    { x: 2, y: 0 },
                    { x: 5, y: 0 },
                ],
                mspConnectionPairIds: ["pair2"],
                pinIds: ["intermediate1", "intermediate2"],
                pins: [] as any,
            },
            {
                mspPairId: "trace3",
                dcConnNetId: "SIGNAL",
                globalConnNetId: "SIGNAL",
                userNetId: "SIGNAL",
                tracePath: [
                    { x: 5, y: 0 },
                    { x: 10, y: 0 },
                ],
                mspConnectionPairIds: ["pair3"],
                pinIds: ["intermediate2", "U2.1"],
                pins: [] as any,
            },
        ]

        const result = mergeCollinearTraces(traces)

        // Snapshot proof: 3 horizontal segments merged into 1 continuous line
        expect(result).toMatchSnapshot()
    })

    test("should merge three collinear vertical trace segments into a single line", () => {
        /**
         * Same test but with vertical traces:
         * - Segment 1: (0, 0) to (0, 2)
         * - Segment 2: (0, 2) to (0, 5)
         * - Segment 3: (0, 5) to (0, 10)
         */
        const traces: SolvedTracePath[] = [
            {
                mspPairId: "trace1",
                dcConnNetId: "VCC",
                globalConnNetId: "VCC",
                userNetId: "VCC",
                tracePath: [
                    { x: 0, y: 0 },
                    { x: 0, y: 2 },
                ],
                mspConnectionPairIds: ["pair1"],
                pinIds: ["pin1"],
                pins: [] as any,
            },
            {
                mspPairId: "trace2",
                dcConnNetId: "VCC",
                globalConnNetId: "VCC",
                userNetId: "VCC",
                tracePath: [
                    { x: 0, y: 2 },
                    { x: 0, y: 5 },
                ],
                mspConnectionPairIds: ["pair2"],
                pinIds: ["pin2"],
                pins: [] as any,
            },
            {
                mspPairId: "trace3",
                dcConnNetId: "VCC",
                globalConnNetId: "VCC",
                userNetId: "VCC",
                tracePath: [
                    { x: 0, y: 5 },
                    { x: 0, y: 10 },
                ],
                mspConnectionPairIds: ["pair3"],
                pinIds: ["pin3"],
                pins: [] as any,
            },
        ]

        const result = mergeCollinearTraces(traces)

        // Snapshot proof: 3 vertical segments merged into 1 continuous line
        expect(result).toMatchSnapshot()
    })

    test("should handle mixed order of segments (not necessarily sequential)", () => {
        /**
         * This test ensures that merging works even when segments are provided
         * in a non-sequential order
         */
        const traces: SolvedTracePath[] = [
            {
                mspPairId: "trace2",
                dcConnNetId: "NET",
                globalConnNetId: "NET",
                userNetId: "NET",
                tracePath: [
                    { x: 2, y: 0 },
                    { x: 5, y: 0 },
                ],
                mspConnectionPairIds: ["pair2"],
                pinIds: ["mid1"],
                pins: [] as any,
            },
            {
                mspPairId: "trace3",
                dcConnNetId: "NET",
                globalConnNetId: "NET",
                userNetId: "NET",
                tracePath: [
                    { x: 5, y: 0 },
                    { x: 10, y: 0 },
                ],
                mspConnectionPairIds: ["pair3"],
                pinIds: ["mid2"],
                pins: [] as any,
            },
            {
                mspPairId: "trace1",
                dcConnNetId: "NET",
                globalConnNetId: "NET",
                userNetId: "NET",
                tracePath: [
                    { x: 0, y: 0 },
                    { x: 2, y: 0 },
                ],
                mspConnectionPairIds: ["pair1"],
                pinIds: ["start"],
                pins: [] as any,
            },
        ]

        const result = mergeCollinearTraces(traces)

        // Snapshot proof: segments in random order still merge correctly
        expect(result).toMatchSnapshot()
    })
})
