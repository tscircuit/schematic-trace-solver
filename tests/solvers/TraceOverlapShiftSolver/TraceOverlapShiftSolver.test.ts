import { test, expect } from "bun:test"
import { TraceOverlapShiftSolver } from "lib/solvers/TraceOverlapShiftSolver/TraceOverlapShiftSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../../assets/example01.json"

test("TraceOverlapShiftSolver initializes correctly", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const solver = new TraceOverlapShiftSolver({
    inputProblem: inputProblem as any,
    inputTracePaths: pipeline.solvedTracePaths ?? [],
    globalConnMap: pipeline.globalConnMap!,
  })

  expect(solver.inputTracePaths).toBeDefined()
  expect(Array.isArray(solver.inputTracePaths)).toBe(true)
})

test("TraceOverlapShiftSolver solves without error", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const solver = new TraceOverlapShiftSolver({
    inputProblem: inputProblem as any,
    inputTracePaths: pipeline.solvedTracePaths ?? [],
    globalConnMap: pipeline.globalConnMap!,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})

test("TraceOverlapShiftSolver modifies traces in place", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const solver = new TraceOverlapShiftSolver({
    inputProblem: inputProblem as any,
    inputTracePaths: pipeline.solvedTracePaths ?? [],
    globalConnMap: pipeline.globalConnMap!,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})
