import { expect, test } from "bun:test"
import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./bug-report-20260708T055430Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260708T055430Z", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )

  solver.solve()

  expect(solver.netLabelPlacementSolver?.failedGroups ?? []).toHaveLength(0)

  const placements = solver.inlineNetLabelSolver!.getOutput().netLabelPlacements

  const vccMcuLabel = placements.find(
    (label) =>
      label.netId === "VCC_3V3" &&
      label.pinIds.includes("U_MCU.6") &&
      label.pinIds.includes("U_MCU.4"),
  )
  expect(vccMcuLabel).toBeDefined()
  expect(vccMcuLabel?.orientation).toBe("y+")

  const gndMcuLabel = placements.find(
    (label) =>
      label.netId === "GND" &&
      label.pinIds.includes("U_MCU.5") &&
      label.pinIds.includes("U_MCU.3"),
  )
  expect(gndMcuLabel).toBeDefined()

  expect(
    getOutputLabelCollisions(solver.inlineNetLabelSolver!.getOutput()),
  ).toEqual([])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
