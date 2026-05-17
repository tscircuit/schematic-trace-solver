import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example35.json"
import "tests/fixtures/matcher"

/** Issue #34: parallel same-net traces before/after MergeParallelTracesSolver */
test("example35 before/after mergeParallelTracesSolver", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solveUntilPhase("mergeParallelTracesSolver")
  expect(solver.traceOverlapShiftSolver).toBeDefined()

  expect(solver.traceOverlapShiftSolver!).toMatchSolverSnapshot(
    import.meta.path,
    "before-mergeParallelTraces",
  )

  while (!solver.mergeParallelTracesSolver?.solved) {
    solver.step()
  }

  expect(solver.mergeParallelTracesSolver!).toMatchSolverSnapshot(
    import.meta.path,
    "after-mergeParallelTraces",
  )
})

test("example35 full pipeline", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
