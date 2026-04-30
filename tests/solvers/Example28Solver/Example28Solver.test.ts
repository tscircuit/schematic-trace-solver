import { test, expect } from "bun:test"
import { Example28Solver } from "lib/solvers/Example28Solver/Example28Solver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../../assets/example01.json"

test("Example28Solver initializes correctly", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const solver = new Example28Solver({
    inputProblem: inputProblem as any,
    traces: pipeline.solvedTracePaths ?? [],
    netLabelPlacements: pipeline.netLabelPlacements ?? [],
  })

  expect(solver.inputProblem).toBeDefined()
  expect(solver.traces).toBeDefined()
})

test("Example28Solver solves without error", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const solver = new Example28Solver({
    inputProblem: inputProblem as any,
    traces: pipeline.solvedTracePaths ?? [],
    netLabelPlacements: pipeline.netLabelPlacements ?? [],
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})

test("Example28Solver produces output traces", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const solver = new Example28Solver({
    inputProblem: inputProblem as any,
    traces: pipeline.solvedTracePaths ?? [],
    netLabelPlacements: pipeline.netLabelPlacements ?? [],
  })

  solver.solve()

  expect(solver.outputTraces).toBeDefined()
  expect(Array.isArray(solver.outputTraces)).toBe(true)
})
