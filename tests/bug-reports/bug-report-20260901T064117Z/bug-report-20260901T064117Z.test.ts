import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260901T064117Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260901T064117Z", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const groundRailLabel = solver
    .netLabelToTraceSolver!.getOutput()
    .netLabelPlacements.find(
      (label) =>
        label.pinIds.includes("schematic_port_7") &&
        label.pinIds.includes("schematic_port_9"),
    )!
  expect(groundRailLabel).toMatchObject({ netId: "GND", orientation: "y-" })
  expect(groundRailLabel.anchorPoint.x).toBeCloseTo(7.25)
  expect(groundRailLabel.anchorPoint.y).toBeCloseTo(-1.58)

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
