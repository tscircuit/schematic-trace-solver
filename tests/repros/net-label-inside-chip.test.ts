import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../bug-reports/bug-report-20260707T230831Z/bug-report-20260707T230831Z.json"

// A net label must never be rendered on top of a chip body — it ends up drawn
// behind the component and is illegible. In this board several net labels are
// placed fully inside chips: NetLabelNetLabelCollisionSolver only relocates a
// label when it overlaps *another label*, so a label sitting inside a chip that
// isn't also colliding with a label is never checked against chips or moved out.
test.failing("net labels are not placed inside chip bodies", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const labels =
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements
  const chips = solver.inputProblem.chips

  const rectBounds = (
    center: { x: number; y: number },
    width: number,
    height: number,
  ) => ({
    minX: center.x - width / 2,
    maxX: center.x + width / 2,
    minY: center.y - height / 2,
    maxY: center.y + height / 2,
  })

  const overlapArea = (
    a: { minX: number; maxX: number; minY: number; maxY: number },
    b: { minX: number; maxX: number; minY: number; maxY: number },
  ) => {
    const ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
    const oy = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
    return ox > 0 && oy > 0 ? ox * oy : 0
  }

  const labelsInsideChips = labels.filter((label) => {
    const labelBounds = rectBounds(label.center, label.width, label.height)
    const labelArea = label.width * label.height
    return chips.some(
      (chip) =>
        overlapArea(
          labelBounds,
          rectBounds(chip.center, chip.width, chip.height),
        ) >
        labelArea * 0.5,
    )
  })

  expect(labelsInsideChips.map((label) => label.netId)).toEqual([])
})
