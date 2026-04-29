
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"
import { inputProblem } from "site/examples/example28-issue34-parallel-traces.page.tsx"

test("snapshot for issue #34 parallel trace merge", async () => {
    const solver = new SchematicTracePipelineSolver(inputProblem)
    solver.solve()

    // Ensure it's solved and we have the expected combined trace
    const combinedTraces = solver.traceCombineSolver?.getOutput().traces ?? []
    expect(combinedTraces.length).toBe(1)

    // @ts-ignore
    await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
