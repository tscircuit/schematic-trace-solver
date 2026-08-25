import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-pmp11282-routing-fallback.input.json"

test("repro PMP11282 exhausts a fixed trace queue budget", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem, {
    hideRatsNet: true,
  })

  solver.solve()

  const traceSolver = solver.schematicTraceLinesSolver!
  expect(solver.failed).toBe(true)
  expect(solver.error).toBe("SchematicTraceLinesSolver ran out of iterations")
  expect(traceSolver.solvedTracePaths).toHaveLength(72)
  expect(traceSolver.failedConnectionPairs).toHaveLength(35)
  expect(traceSolver.queuedConnectionPairs).toHaveLength(95)
  expect(traceSolver).toMatchSolverSnapshot(import.meta.path)
}, 30_000)
