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

  const defaultPipeline = new SchematicTracePipelineSolver(
    cloneInputProblem(),
    { hideRatsNet: true },
  )
  defaultPipeline.solve()

  const defaultTraceSolver = defaultPipeline.schematicTraceLinesSolver!
  expect(defaultPipeline.solved).toBe(false)
  expect(defaultPipeline.failed).toBe(true)
  expect(defaultPipeline.error).toBe(
    "SchematicTraceLinesSolver ran out of iterations",
  )
  expect(defaultTraceSolver.solvedTracePaths).toHaveLength(70)
  expect(defaultTraceSolver.failedConnectionPairs).toHaveLength(37)
  expect(defaultTraceSolver.queuedConnectionPairs).toHaveLength(95)

  // Let the same unmodified production pipeline reach its downstream stages
  // by increasing only this test instance's nested-solver budget. This keeps
  // the reproduction production-code-free while exposing the resulting labels.
  const diagnosticPipeline = new SchematicTracePipelineSolver(
    cloneInputProblem(),
    { hideRatsNet: true },
  )
  diagnosticPipeline.solveUntilPhase("schematicTraceLinesSolver")
  diagnosticPipeline.step()
  diagnosticPipeline.schematicTraceLinesSolver!.MAX_ITERATIONS *=
    diagnosticPipeline.mspConnectionPairSolver!.mspConnectionPairs.length
  diagnosticPipeline.solve()

  const finalOutput = diagnosticPipeline.inlineNetLabelSolver!.getOutput()
  const endpointPairLabels = finalOutput.netLabelPlacements.filter((label) =>
    label.netId?.includes(" to "),
  )
  const endpointPairNetIds = new Set(
    endpointPairLabels.map((label) => label.netId!),
  )

  expect(diagnosticPipeline.solved).toBe(true)
  expect(diagnosticPipeline.failed).toBe(false)
  expect(
    diagnosticPipeline.schematicTraceLinesSolver!.solvedTracePaths,
  ).toHaveLength(144)
  expect(
    diagnosticPipeline.schematicTraceLinesSolver!.failedConnectionPairs,
  ).toHaveLength(59)
  expect(
    diagnosticPipeline.schematicTraceLinesSolver!.solvedTracePaths.map(
      (trace) => trace.mspPairId,
    ),
  ).toContain("schematic_port_20-schematic_port_34")
  expect(finalOutput.netLabelPlacements).toHaveLength(107)
  expect(endpointPairLabels).toHaveLength(79)
  expect(endpointPairNetIds.size).toBe(61)
  expect(endpointPairNetIds).toContain("U500.pin8 to C501.pin1")
  expect(endpointPairNetIds).toContain("L500.pin1 to L500.pin2")
  expect(diagnosticPipeline).toMatchSolverSnapshot(import.meta.path)
}, 30_000)
