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

test("does not recover a marked ground alias that is not named GND", () => {
  const aliased = structuredClone(inputProblem) as any
  for (const net of aliased.netConnections) {
    if (net.netId !== "GND") continue
    net.netId = "AGND"
    net.isGround = true
  }
  aliased.availableNetLabelOrientations = {
    VCC: aliased.availableNetLabelOrientations.VCC,
    AGND: aliased.availableNetLabelOrientations.GND,
  }

  const pipelineSolver = new SchematicTracePipelineSolver(aliased)
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
