
import { test, expect } from "bun:test"
import { TraceCombineSolver } from "../lib/solvers/TraceCombineSolver/TraceCombineSolver"
import type { SolvedTracePath } from "../lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "../lib/types/InputProblem"

const mockInputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
}

test("TraceCombineSolver should merge close parallel traces", () => {
    const trace1: SolvedTracePath = {
        mspPairId: "1",
        mspConnectionPairIds: ["1"],
        globalConnNetId: "NET1",
        pinIds: [],
        tracePath: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
        ],
    } as any

    const trace2: SolvedTracePath = {
        mspPairId: "2",
        mspConnectionPairIds: ["2"],
        globalConnNetId: "NET1", // Same net
        pinIds: [],
        tracePath: [
            { x: 2, y: 0.01 }, // Very close Y
            { x: 12, y: 0.01 },
        ],
    } as any

    const solver = new TraceCombineSolver({
        inputTraces: [trace1, trace2],
        inputProblem: mockInputProblem,
    })

    solver.solve()

    const output = solver.getOutput()

    // Should assume they are merged because they are on the same net and very close?
    expect(output.traces.length).toBe(1)

    // Verify alignment
    const merged = output.traces[0]
    // Y should be consistent
    const uniqueYs = new Set(merged.tracePath.map(p => p.y))
    expect(uniqueYs.size).toBe(1)
})
