import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example51.json"
import "tests/fixtures/matcher"

test("example51", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any, {
    hideRatsNet: true,
  })

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
