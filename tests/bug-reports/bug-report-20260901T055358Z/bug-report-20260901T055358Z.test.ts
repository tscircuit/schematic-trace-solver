import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260901T055358Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260901T055358Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const dvddV1V1Label = solver
    .netLabelToTraceSolver!.getOutput()
    .netLabelPlacements.find(
      (label) =>
        label.netId === "V1V1" && label.pinIds.includes("schematic_port_89"),
    )
  expect(dvddV1V1Label?.orientation).toBe("y+")

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
