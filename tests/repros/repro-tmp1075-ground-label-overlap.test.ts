import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-tmp1075-ground-label-overlap.input.json"

test("repro TMP1075 ground label overlap", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as InputProblem,
    {
      hideRatsNet: true,
    },
  )

  solver.solve()

  const finalOutput = solver.netLabelToTraceSolver!.getOutput()
  const groundRailLabel = finalOutput.netLabelPlacements.find((label) =>
    label.pinIds.includes("schematic_port_18"),
  )
  const lowerGroundRailTrace = finalOutput.traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_7") &&
      trace.pinIds.includes("schematic_port_8"),
  )

  expect(groundRailLabel?.anchorPoint.y).toBeCloseTo(-1.075)
  expect(lowerGroundRailTrace?.tracePath[1]?.x).toBeCloseTo(4.25)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
