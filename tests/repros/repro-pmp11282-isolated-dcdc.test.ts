import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-pmp11282-isolated-dcdc.input.json"

const cloneInputProblem = (): InputProblem =>
  JSON.parse(JSON.stringify(inputProblemJson))

test("repro PMP11282 isolated DC/DC traces and endpoint net labels", () => {
  const inputProblem = cloneInputProblem()
  const pairSolver = new MspConnectionPairSolver({ inputProblem })

  pairSolver.solve()

  const uniquePairIds = new Set(
    pairSolver.mspConnectionPairs.map((pair) => pair.mspPairId),
  )
  expect(inputProblem.chips).toHaveLength(112)
  expect(inputProblem.directConnections).toHaveLength(163)
  expect(pairSolver.solved).toBe(true)
  expect(pairSolver.mspConnectionPairs).toHaveLength(203)
  expect(uniquePairIds.size).toBe(203)

  const pipeline = new SchematicTracePipelineSolver(cloneInputProblem(), {
    hideRatsNet: true,
  })
  pipeline.solve()

  const traceSolver = pipeline.schematicTraceLinesSolver!
  expect(pipeline.solved).toBe(true)
  expect(pipeline.failed).toBe(false)
  expect(pipeline.error).toBeNull()
  expect(traceSolver.solvedTracePaths).toHaveLength(145)
  expect(traceSolver.failedConnectionPairs).toHaveLength(58)
  expect(traceSolver.queuedConnectionPairs).toHaveLength(0)

  const finalOutput = pipeline.inlineNetLabelSolver!.getOutput()
  const endpointPairLabels = finalOutput.netLabelPlacements.filter((label) =>
    label.netId?.includes(" to "),
  )
  const endpointPairNetIds = new Set(
    endpointPairLabels.map((label) => label.netId!),
  )

  expect(finalOutput.netLabelPlacements).toHaveLength(106)
  expect(endpointPairLabels).toHaveLength(80)
  expect(endpointPairNetIds.size).toBe(62)
  expect(endpointPairNetIds).toContain("U500.pin8 to C501.pin1")
  expect(endpointPairNetIds).toContain("L500.pin1 to L500.pin2")
  expect(pipeline).toMatchSolverSnapshot(import.meta.path)
}, 30_000)
