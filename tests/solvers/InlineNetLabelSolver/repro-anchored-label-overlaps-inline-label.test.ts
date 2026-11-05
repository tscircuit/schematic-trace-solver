import { expect, test } from "bun:test"
import type { Bounds } from "@tscircuit/math-utils"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { boundsOverlap } from "lib/utils/textBoxBounds"
import inputProblem from "../../assets/inline-net-label-anchored-label-overlap.json"
import "tests/fixtures/matcher"

const getBounds = (placement: {
  center: { x: number; y: number }
  width: number
  height: number
  axis?: "x" | "y"
}): Bounds => {
  const width = placement.axis === "y" ? placement.height : placement.width
  const height = placement.axis === "y" ? placement.width : placement.height
  return {
    minX: placement.center.x - width / 2,
    maxX: placement.center.x + width / 2,
    minY: placement.center.y - height / 2,
    maxY: placement.center.y + height / 2,
  }
}

test("repro: anchored net label overlaps adjacent inline label", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.inlineNetLabelSolver!.getOutput()
  const regularLabels = output.netLabelPlacements.filter((label) =>
    ["D_MINUS", "D_PLUS"].includes(label.netId ?? ""),
  )
  const inlineLabel = output.inlineNetLabelPlacements.find(
    (label) => label.netId === "SWCLK",
  )

  expect(regularLabels).toHaveLength(2)
  expect(inlineLabel).toBeDefined()
  expect(
    regularLabels.some((label) =>
      boundsOverlap(getBounds(label), getBounds(inlineLabel!)),
    ),
  ).toBe(true)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
