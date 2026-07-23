import { test, expect } from "vitest"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example01.json"
import "tests/fixtures/matcher"

test("example01", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toBeDefined()
})
s
