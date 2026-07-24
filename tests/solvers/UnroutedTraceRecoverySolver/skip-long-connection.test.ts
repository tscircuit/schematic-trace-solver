import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { UnroutedTraceRecoverySolver } from "lib/solvers/UnroutedTraceRecoverySolver/UnroutedTraceRecoverySolver"
import inputProblem from "tests/bug-reports/bug-report-20260724T175257Z/bug-report-20260724T175257Z.json"

test("does not recover connection pairs beyond maxMspPairDistance", () => {
  const pipelineSolver = new SchematicTracePipelineSolver(inputProblem as any)
  pipelineSolver.solveUntilPhase("unroutedTraceRecoverySolver")

  const recoverySolver = new UnroutedTraceRecoverySolver({
    inputProblem: {
      ...pipelineSolver.inputProblem,
      maxMspPairDistance: 1,
    },
    failedConnectionPairs:
      pipelineSolver.schematicTraceLinesSolver!.failedConnectionPairs,
    alreadySolvedTraces:
      pipelineSolver.longDistancePairSolver!.getOutput().allTracesMerged,
  })

  recoverySolver.solve()

  expect(recoverySolver.solvedUnroutedTraces).toHaveLength(0)
})
