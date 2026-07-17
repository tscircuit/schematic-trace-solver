import { expect, test } from "bun:test"
import { SideChildNetLabelAlignmentSolver } from "lib/solvers/SideChildNetLabelAlignmentSolver/SideChildNetLabelAlignmentSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../repros/assets/repro-pca9306-level-shifter.input.json"

test("aligns side labels into outward columns", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const solver = pipeline.sideChildNetLabelAlignmentSolver!

  const getAnchorX = (netId: string) =>
    solver.outputNetLabelPlacements.find(
      (label) =>
        label.netId === netId &&
        label.pinIds.some((pinId) => pinId.startsWith("U1.")),
    )!.anchorPoint.x

  expect(getAnchorX("SCL1")).toBe(getAnchorX("SDA1"))
  expect(getAnchorX("EN")).toBe(getAnchorX("SCL2"))
  expect(getAnchorX("SCL2")).toBe(getAnchorX("SDA2"))
  expect(solver.outputTraces).toHaveLength(
    pipeline.netLabelTraceCollisionSolver!.getOutput().traces.length + 3,
  )
})
