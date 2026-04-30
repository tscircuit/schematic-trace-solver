import { test, expect } from "bun:test"
import { VccNetLabelCornerPlacementSolver } from "lib/solvers/VccNetLabelCornerPlacementSolver/VccNetLabelCornerPlacementSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../../assets/example01.json"

test("VccNetLabelCornerPlacementSolver initializes correctly", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const solver = new VccNetLabelCornerPlacementSolver({
    inputProblem: inputProblem as any,
    traces: pipeline.solvedTracePaths ?? [],
    netLabelPlacements: pipeline.netLabelPlacements ?? [],
  })

  expect(solver.outputNetLabelPlacements).toBeDefined()
  expect(Array.isArray(solver.outputNetLabelPlacements)).toBe(true)
})

test("VccNetLabelCornerPlacementSolver solves without error", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const solver = new VccNetLabelCornerPlacementSolver({
    inputProblem: inputProblem as any,
    traces: pipeline.solvedTracePaths ?? [],
    netLabelPlacements: pipeline.netLabelPlacements ?? [],
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})

test("VccNetLabelCornerPlacementSolver preserves all labels", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const inputLabels = pipeline.netLabelPlacements ?? []

  const solver = new VccNetLabelCornerPlacementSolver({
    inputProblem: inputProblem as any,
    traces: pipeline.solvedTracePaths ?? [],
    netLabelPlacements: inputLabels,
  })

  solver.solve()

  // Should preserve all input labels
  expect(solver.outputNetLabelPlacements.length).toBeGreaterThanOrEqual(
    inputLabels.length,
  )
})
