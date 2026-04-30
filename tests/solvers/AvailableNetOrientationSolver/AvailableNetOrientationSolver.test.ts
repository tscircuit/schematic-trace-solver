import { test, expect } from "bun:test"
import { AvailableNetOrientationSolver } from "lib/solvers/AvailableNetOrientationSolver/AvailableNetOrientationSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../../assets/example01.json"

test("AvailableNetOrientationSolver initializes correctly", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const solver = new AvailableNetOrientationSolver({
    inputProblem: inputProblem as any,
    traces: pipeline.solvedTracePaths ?? [],
    netLabelPlacements: pipeline.netLabelPlacements ?? [],
  })

  expect(solver.inputProblem).toBeDefined()
  expect(solver.traces).toBeDefined()
})

test("AvailableNetOrientationSolver solves without error", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const solver = new AvailableNetOrientationSolver({
    inputProblem: inputProblem as any,
    traces: pipeline.solvedTracePaths ?? [],
    netLabelPlacements: pipeline.netLabelPlacements ?? [],
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})

test("AvailableNetOrientationSolver produces output placements", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const solver = new AvailableNetOrientationSolver({
    inputProblem: inputProblem as any,
    traces: pipeline.solvedTracePaths ?? [],
    netLabelPlacements: pipeline.netLabelPlacements ?? [],
  })

  solver.solve()

  expect(solver.outputNetLabelPlacements).toBeDefined()
  expect(Array.isArray(solver.outputNetLabelPlacements)).toBe(true)
})
