import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-pmp11282-routing-fallback.input.json"

test("PMP11282 fallback labels expose generated endpoint-pair text", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem, {
    hideRatsNet: true,
  })

  solver.solve()

  const finalOutput = solver.inlineNetLabelSolver!.getOutput()
  const endpointPairLabels = finalOutput.netLabelPlacements.filter((label) =>
    label.netId?.includes(" to "),
  )
  const endpointPairNetIds = new Set(
    endpointPairLabels.map((label) => label.netId!),
  )

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(finalOutput.netLabelPlacements).toHaveLength(106)
  expect(endpointPairLabels).toHaveLength(80)
  expect(endpointPairNetIds.size).toBe(62)
  expect(endpointPairNetIds).toContain("U500.pin8 to C501.pin1")
  expect(endpointPairNetIds).toContain("L500.pin1 to L500.pin2")
  expect(solver).toMatchSolverSnapshot(import.meta.path)
}, 30_000)
