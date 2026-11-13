import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260804T171919Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260804T171919Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const netLabelPlacements =
    solver.availableNetOrientationSolver?.outputNetLabelPlacements ?? []
  const v3v3Label = netLabelPlacements.find(
    (label) =>
      label.pinIds.length === 1 && label.pinIds[0] === "schematic_port_154",
  )
  const gndLabel = netLabelPlacements.find(
    (label) =>
      label.pinIds.length === 1 && label.pinIds[0] === "schematic_port_152",
  )

  expect(v3v3Label?.orientation).toBe("y+")
  expect(gndLabel?.orientation).toBe("y-")

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
