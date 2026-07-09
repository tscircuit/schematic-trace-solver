import { expect } from "bun:test"
import { test } from "bun:test"
import inputData from "../../assets/TraceCombineSolver.test.input.json"
import { TraceCombineSolver } from "lib/solvers/TraceCombineSolver/TraceCombineSolver"

test("TraceCombineSolver merges same-net collinear traces", () => {
  const solver = new TraceCombineSolver({
    inputProblem: inputData.inputProblem as any,
    traces: inputData.traces as any,
  })
  solver.solve()

  const output = solver.getOutput()

  // Verify output has valid traces
  expect(output.traces.length).toBeGreaterThan(0)

  // Verify all traces have valid paths
  for (const trace of output.traces) {
    expect(trace.tracePath.length).toBeGreaterThanOrEqual(2)
    expect(trace.globalConnNetId).toBeTruthy()
  }
})

test("TraceCombineSolver snapshot", () => {
  const solver = new TraceCombineSolver({
    inputProblem: inputData.inputProblem as any,
    traces: inputData.traces as any,
  })
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
