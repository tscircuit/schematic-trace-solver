import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const MAX_OVERLAP_ITERATIONS_FOR_REPRO = 100

test("board 1273 exhausts the trace overlap iteration limit", async () => {
  const inputProblem = JSON.parse(
    await Bun.file(
      new URL(
        "./assets/board-1273-trace-overlap-cycle.input.json",
        import.meta.url,
      ),
    ).text(),
  ) as InputProblem
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solveUntilPhase("traceOverlapShiftSolver")
  solver.step()
  solver.traceOverlapShiftSolver!.MAX_ITERATIONS =
    MAX_OVERLAP_ITERATIONS_FOR_REPRO
  solver.solve()

  expect(solver.failed).toBe(true)
  expect(solver.traceOverlapShiftSolver?.failed).toBe(true)
  expect(solver.error).toBe("TraceOverlapShiftSolver ran out of iterations")
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
