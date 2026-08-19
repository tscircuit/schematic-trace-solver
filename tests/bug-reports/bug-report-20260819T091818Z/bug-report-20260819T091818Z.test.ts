import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260819T091818Z.json"
import "tests/fixtures/matcher"

test("disconnected netlabel", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)

  const vddLabel = solver.inlineNetLabelSolver
    ?.getOutput()
    .netLabelPlacements.find(
      (label) =>
        label.netId === "VDD_0V9" && label.pinIds.includes("schematic_port_99"),
    )
  expect(vddLabel?.anchorPoint).toEqual({
    x: -1.551,
    y: 4.600999999999994,
  })
})
