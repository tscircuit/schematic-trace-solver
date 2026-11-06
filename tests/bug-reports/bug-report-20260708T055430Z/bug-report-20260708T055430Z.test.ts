import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260708T055430Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260708T055430Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const netLabelPlacements =
    solver.availableNetOrientationSolver?.outputNetLabelPlacements ?? []
  const leftVccLabel = netLabelPlacements.find(
    (label) => label.netId === "VCC_3V3" && label.pinIds.includes("U_MCU.6"),
  )
  const leftGndLabel = netLabelPlacements.find(
    (label) => label.netId === "GND" && label.pinIds.includes("U_MCU.5"),
  )

  expect(leftVccLabel?.orientation).toBe("y+")
  expect(leftGndLabel?.orientation).toBe("y-")

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
