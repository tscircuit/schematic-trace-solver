import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../repros/assets/repro-pca9306-level-shifter.input.json"

test("aligns side labels only when the connector path is clear", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const solver = pipeline.sideChildNetLabelAlignmentSolver!

  const getAnchorX = (netId: string, labels = solver.outputNetLabelPlacements) =>
    labels.find(
      (label) =>
        label.netId === netId &&
        label.pinIds.some((pinId) => pinId.startsWith("U1.")),
    )!.anchorPoint.x

  expect(getAnchorX("SCL1")).toBe(getAnchorX("SDA1"))
  const labelsBeforeAlignment =
    pipeline.netLabelNetLabelCollisionSolver!.outputNetLabelPlacements
  expect(getAnchorX("EN")).toBe(getAnchorX("EN", labelsBeforeAlignment))
  expect(getAnchorX("SCL2")).toBe(getAnchorX("SCL2", labelsBeforeAlignment))
  expect(getAnchorX("SDA2")).toBe(getAnchorX("SDA2", labelsBeforeAlignment))
  expect(solver.outputTraces).toHaveLength(
    pipeline.netLabelTraceCollisionSolver!.getOutput().traces.length + 1,
  )
})
