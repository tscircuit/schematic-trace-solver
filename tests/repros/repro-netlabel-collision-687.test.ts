import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-netlabel-collision-687.input.json"
import "tests/fixtures/matcher"

const boundsOf = (label: {
  center: { x: number; y: number }
  width: number
  height: number
}) => ({
  minX: label.center.x - label.width / 2,
  maxX: label.center.x + label.width / 2,
  minY: label.center.y - label.height / 2,
  maxY: label.center.y + label.height / 2,
})

const overlapArea = (
  a: ReturnType<typeof boundsOf>,
  b: ReturnType<typeof boundsOf>,
) => {
  const w = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
  const h = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
  return w > 0 && h > 0 ? w * h : 0
}

// Reproduction for #687, minimized from bug-report-20260721T221026Z.
//
// U1's right-edge pin column is fully walled in: a solid column of port
// labels (QD0..QD3, QCLK) to the east, chips C1/C2 above and below, and
// chip U3 closing off the corridor. The V1V1 trace (U1.1 -> U1.7) wraps
// around the label column. Previously NetLabelNetLabelCollisionSolver gave
// up and left the V1V1 label stacked directly on top of the QD3 and QCLK
// port labels. Port-only labels can now slide their anchor outward from the
// pin (see #655), which gives V1V1 a collision-free escape.
test("repro #687: V1V1 net label left stacked on QD3/QCLK port labels", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const labels =
    solver.netLabelNetLabelCollisionSolver!.outputNetLabelPlacements

  const v1v1 = labels.find((l) => l.netId === "V1V1")!
  const qd3 = labels.find((l) => l.netId === "QD3" && l.center.x < 3)!
  const qclk = labels.find((l) => l.netId === "QCLK" && l.center.x < 3)!
  expect(v1v1).toBeDefined()
  expect(qd3).toBeDefined()
  expect(qclk).toBeDefined()

  // FIXED: the V1V1 label no longer overlaps the QD3/QCLK port labels
  expect(overlapArea(boundsOf(v1v1), boundsOf(qd3))).toBe(0)
  expect(overlapArea(boundsOf(v1v1), boundsOf(qclk))).toBe(0)

  // visual snapshot: the V1V1 label escapes the QD3/QCLK pile-up
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
