import { expect, test } from "bun:test"
import { TraceCombineSolver } from "lib/solvers/TraceCombineSolver/TraceCombineSolver"
import input from "../../assets/TraceCombineSolver_repro29.input.json"
import "tests/fixtures/matcher"

test("TraceCombineSolver_repro29 combines close parallel same-net traces", () => {
  const solver = new TraceCombineSolver({
    inputProblem: input.inputProblem as any,
    inputTracePaths: input.inputTracePaths as any,
  })
  solver.solve()

  const traces = solver.getOutput().traces
  expect(traces).toHaveLength(1)
  expect(traces[0]!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 4, y: 1 },
  ])
  expect(traces[0]!.mspConnectionPairIds).toEqual(["trace-a", "trace-b"])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
