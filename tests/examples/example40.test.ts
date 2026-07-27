import { test, expect } from "vitest"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example40.json"
import "tests/fixtures/matcher"

test("example40", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toBeDefined();
});
