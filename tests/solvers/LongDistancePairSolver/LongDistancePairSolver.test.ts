import { test, expect } from "bun:test"
import { LongDistancePairSolver } from "lib/solvers/LongDistancePairSolver/LongDistancePairSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../../assets/example01.json"

test("LongDistancePairSolver initializes correctly", () => {
  // First run the pipeline to get solved traces
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  // Create LongDistancePairSolver with the solved traces
  const solver = new LongDistancePairSolver({
    inputProblem: inputProblem as any,
    alreadySolvedTraces: pipeline.solvedTracePaths ?? [],
    primaryMspConnectionPairs: pipeline.mspConnectionPairs ?? [],
  })

  expect(solver.solvedLongDistanceTraces).toBeDefined()
  expect(Array.isArray(solver.solvedLongDistanceTraces)).toBe(true)
})

test("LongDistancePairSolver solves without error", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const solver = new LongDistancePairSolver({
    inputProblem: inputProblem as any,
    alreadySolvedTraces: pipeline.solvedTracePaths ?? [],
    primaryMspConnectionPairs: pipeline.mspConnectionPairs ?? [],
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})

test("LongDistancePairSolver produces valid output", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const solver = new LongDistancePairSolver({
    inputProblem: inputProblem as any,
    alreadySolvedTraces: pipeline.solvedTracePaths ?? [],
    primaryMspConnectionPairs: pipeline.mspConnectionPairs ?? [],
  })

  solver.solve()

  // Output should be a valid array
  expect(Array.isArray(solver.solvedLongDistanceTraces)).toBe(true)
})
