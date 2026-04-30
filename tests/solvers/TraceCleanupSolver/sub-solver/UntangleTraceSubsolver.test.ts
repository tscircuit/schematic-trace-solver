import { test, expect } from "bun:test"
import { UntangleTraceSubsolver } from "lib/solvers/TraceCleanupSolver/sub-solver/UntangleTraceSubsolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../../../assets/example01.json"

test("UntangleTraceSubsolver initializes correctly", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const subsolver = new UntangleTraceSubsolver({
    inputProblem: inputProblem as any,
    allTraces: pipeline.solvedTracePaths ?? [],
    allLabelPlacements: pipeline.netLabelPlacements ?? [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.5,
  })

  expect(subsolver).toBeDefined()
  expect(subsolver.failed).toBe(false)
})

test("UntangleTraceSubsolver solves without error", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const subsolver = new UntangleTraceSubsolver({
    inputProblem: inputProblem as any,
    allTraces: pipeline.solvedTracePaths ?? [],
    allLabelPlacements: pipeline.netLabelPlacements ?? [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.5,
  })

  subsolver.solve()

  expect(subsolver.solved).toBe(true)
  expect(subsolver.failed).toBe(false)
})
