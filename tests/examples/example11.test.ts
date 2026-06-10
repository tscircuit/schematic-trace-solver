import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example11.json"

test("example11", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.getOutput()
  expect(output.traces.length).toBeGreaterThan(0)
  expect(solver.solved).toBe(true)
})
