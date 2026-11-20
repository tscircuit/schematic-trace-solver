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

test("skips non-GND nets marked isGround and recovers manually named non-ground GND nets", () => {
  const aliasProblem = structuredClone(inputProblem) as any
  const gndConn = aliasProblem.netConnections.find(
    (connection: any) => connection.netId === "GND",
  )!
  gndConn.netId = "AGND"
  gndConn.isGround = true

  const aliasPipeline = new SchematicTracePipelineSolver(aliasProblem)
  aliasPipeline.solveUntilPhase("unroutedTraceRecoverySolver")
  const aliasFailedPairs =
    aliasPipeline.schematicTraceLinesSolver!.failedConnectionPairs
  const aliasRecovery = new UnroutedTraceRecoverySolver({
    inputProblem: aliasPipeline.inputProblem,
    failedConnectionPairs: aliasFailedPairs,
    alreadySolvedTraces:
      aliasPipeline.longDistancePairSolver!.getOutput().allTracesMerged,
  })
  aliasRecovery.solve()
  expect(aliasFailedPairs).not.toHaveLength(0)
  expect(aliasRecovery.solvedUnroutedTraces).toHaveLength(0)

  const manualNonGroundGndProblem = structuredClone(inputProblem) as any
  manualNonGroundGndProblem.netConnections.find(
    (connection: any) => connection.netId === "GND",
  )!.isGround = false

  const manualPipeline = new SchematicTracePipelineSolver(
    manualNonGroundGndProblem,
  )
  manualPipeline.solveUntilPhase("unroutedTraceRecoverySolver")
  const manualRecovery = new UnroutedTraceRecoverySolver({
    inputProblem: manualPipeline.inputProblem,
    failedConnectionPairs:
      manualPipeline.schematicTraceLinesSolver!.failedConnectionPairs,
    alreadySolvedTraces:
      manualPipeline.longDistancePairSolver!.getOutput().allTracesMerged,
  })
  manualRecovery.solve()
  expect(manualRecovery.solvedUnroutedTraces.length).toBeGreaterThan(0)
})
