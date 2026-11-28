import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "tests/bug-reports/bug-report-20261104T110624Z/bug-report-20261104T110624Z.json"

const solverInput: InputProblem = JSON.parse(JSON.stringify(inputProblem))

test("attaches same-side vertical power rails at their upper rail corners", () => {
  const solver = new SchematicTracePipelineSolver(solverInput)

  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.inlineNetLabelSolver?.getOutput()
  if (!output) throw new Error("Expected inlineNetLabelSolver output")

  const vccChgLabel = output.netLabelPlacements.find(
    (placement) => placement.netId === "VCC_CHG",
  )
  const vrefLabel = output.netLabelPlacements.find(
    (placement) => placement.netId === "VREF",
  )
  expect(vccChgLabel?.orientation).toBe("y+")
  expect(vccChgLabel?.anchorPoint.y).toBeCloseTo(0.9, 6)
  expect(vrefLabel?.orientation).toBe("y+")
  expect(vrefLabel?.anchorPoint.y).toBeCloseTo(0.3, 6)
})
