import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-pmp11282-routing-fallback.input.json"

test("PMP11282 gives every trace pair its own routing attempt", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem, {
    hideRatsNet: true,
  })

  solver.solve()

  const traceSolver = solver.schematicTraceLinesSolver!
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.error).toBeNull()
  expect(traceSolver.solvedTracePaths).toHaveLength(145)
  expect(traceSolver.failedConnectionPairs).toHaveLength(58)
  expect(traceSolver.queuedConnectionPairs).toHaveLength(0)
  expect(traceSolver).toMatchSolverSnapshot(import.meta.path)
}, 30_000)
