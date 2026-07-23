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
// around the label column, and its net label has NO strictly collision-free
// candidate anywhere along the trace.
//
// Before the fallback fix, NetLabelNetLabelCollisionSolver gave up and left
// the V1V1 label stacked directly on top of the QD3 and QCLK port labels
// (total stacked overlap ≈ 0.16). With the fallback, the label moves to the
// least-overlapping candidate instead.
test("repro #687: V1V1 net label no longer stacked on QD3/QCLK port labels", () => {
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

  // FIXED: the V1V1 label no longer overlaps either port label
  expect(overlapArea(boundsOf(v1v1), boundsOf(qd3))).toBe(0)
  expect(overlapArea(boundsOf(v1v1), boundsOf(qclk))).toBe(0)

  // the fallback must strictly reduce total label-label overlap, not just
  // push the problem elsewhere. The scene has no fully-free spot by
  // construction, so some residual overlap is inherent (pre-fix total was
  // ≈ 0.16 with V1V1 stacked dead-center on two labels).
  let totalOverlap = 0
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (labels[i]!.globalConnNetId === labels[j]!.globalConnNetId) continue
      totalOverlap += overlapArea(boundsOf(labels[i]!), boundsOf(labels[j]!))
    }
  }
  expect(totalOverlap).toBeLessThan(0.13)

  // the fallback must never run a wire through the label's text: no trace
  // segment may pass through the V1V1 label bounds (its own host segment
  // touches the bounds edge at the anchor, which is fine)
  const v1v1Bounds = boundsOf(v1v1)
  const traces = solver.netLabelNetLabelCollisionSolver!.traces
  let crossedLength = 0
  for (const trace of traces) {
    const pts = trace.tracePath
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i]!
      const p2 = pts[i + 1]!
      if (Math.abs(p1.x - p2.x) < 1e-6) {
        if (p1.x <= v1v1Bounds.minX || p1.x >= v1v1Bounds.maxX) continue
        crossedLength += Math.max(
          0,
          Math.min(Math.max(p1.y, p2.y), v1v1Bounds.maxY) -
            Math.max(Math.min(p1.y, p2.y), v1v1Bounds.minY),
        )
      } else if (Math.abs(p1.y - p2.y) < 1e-6) {
        if (p1.y <= v1v1Bounds.minY || p1.y >= v1v1Bounds.maxY) continue
        crossedLength += Math.max(
          0,
          Math.min(Math.max(p1.x, p2.x), v1v1Bounds.maxX) -
            Math.max(Math.min(p1.x, p2.x), v1v1Bounds.minX),
        )
      }
    }
  }
  expect(crossedLength).toBe(0)

  // visual snapshot: the V1V1 label sits clear of the QD3/QCLK column
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
