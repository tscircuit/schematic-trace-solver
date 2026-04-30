import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../../assets/example01.json"

test("SchematicTracePipelineSolver initializes correctly", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  expect(solver).toBeDefined()
  expect(solver.failed).toBe(false)
})

test("SchematicTracePipelineSolver solves without error", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})

test("SchematicTracePipelineSolver completes pipeline", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()
  // Pipeline runs to completion without throwing
  expect(true).toBe(true)
})
