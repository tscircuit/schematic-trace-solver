import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-core-ground-inline-label-fallback.input.json"

const signalNetIds = new Set(["step", "direction", "enable"])

// Captured from @tscircuit/core's
// ground-net-label-preserves-solver-orientation test. These three two-pin
// signal nets opt into inline labels. Neighboring shared LOGIC_3V3 and GND
// labels must not make post-processing mistake their terminal stubs for
// collisions with vertically encoded rail-label bounds.
test("keeps core inline signal labels near shared rail labels", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const inlineOutput = solver.inlineNetLabelSolver!.getOutput()
  const signalInlineLabels = inlineOutput.inlineNetLabelPlacements.filter(
    (placement) => signalNetIds.has(placement.netId ?? ""),
  )
  const signalAnchoredLabels = inlineOutput.netLabelPlacements.filter(
    (placement) => signalNetIds.has(placement.netId ?? ""),
  )

  expect(signalInlineLabels).toHaveLength(6)
  expect(signalAnchoredLabels).toHaveLength(0)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
