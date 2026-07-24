import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { UnroutedTraceRecoverySolver } from "lib/solvers/UnroutedTraceRecoverySolver/UnroutedTraceRecoverySolver"
import inputProblem from "tests/assets/example12.json"

test("does not recover the canonical ground connectivity net", () => {
  const pipelineSolver = new SchematicTracePipelineSolver(inputProblem as any)
  pipelineSolver.solveUntilPhase("unroutedTraceRecoverySolver")

  const failedConnectionPairs =
    pipelineSolver.schematicTraceLinesSolver!.failedConnectionPairs.map(
      (connectionPair) => {
        return {
          ...connectionPair,
          userNetId: undefined,
        }
      },
    )
  const recoverySolver = new UnroutedTraceRecoverySolver({
    inputProblem: pipelineSolver.inputProblem,
    failedConnectionPairs,
    alreadySolvedTraces:
      pipelineSolver.longDistancePairSolver!.getOutput().allTracesMerged,
  })

  recoverySolver.solve()

  expect(failedConnectionPairs).not.toHaveLength(0)
  expect(recoverySolver.solvedUnroutedTraces).toHaveLength(0)
})
