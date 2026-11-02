import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { pathIntersectsRenderedLabel } from "lib/utils/pathIntersectsRenderedLabel"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-smart-ring-radio-ground-label.input.json"

test("smart-ring Radio pin 49 GND label overlaps the pin 45 trace", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()
  expect(solver.solved).toBe(true)

  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const groundLabel = netLabelPlacements.find(
    (label) =>
      label.netId === "GND" && label.pinIds.includes("schematic_port_169"),
  )!
  const groundTrace = traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_151") &&
      trace.pinIds.includes("schematic_port_165"),
  )!

  // Record the current bug: the rail symbol extends through pin 45's wire,
  // although its dedicated connector could end earlier above that wire.
  expect(pathIntersectsRenderedLabel(groundTrace.tracePath, groundLabel)).toBe(
    true,
  )
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
