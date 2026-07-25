import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../bug-reports/bug-report-636/bug-report-636.json"

// https://github.com/tscircuit/schematic-trace-solver/issues/636
// A second, independently reported board that hit the same buried-label bug as
// #655. On main this produced four labels drawn on top of chip bodies, and two
// of them additionally ended up on an orientation the input had not allowed —
// the orientation constraint was collateral damage of the bad placement, not a
// separate bug, so both are asserted here.

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

test("bug-report-636: net labels are not placed inside chip bodies", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const labels =
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements
  const chips = solver.inputProblem.chips

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

test("bug-report-636: net labels honor availableNetLabelOrientations", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const labels =
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements
  const availableOrientations =
    solver.inputProblem.availableNetLabelOrientations ?? {}

  const violations = labels
    .filter((label) => {
      if (!label.netId) return false
      const allowed = availableOrientations[label.netId]
      return Boolean(allowed?.length) && !allowed!.includes(label.orientation)
    })
    .map((label) => `${label.netId}:${label.orientation}`)

  expect(violations).toEqual([])
})
