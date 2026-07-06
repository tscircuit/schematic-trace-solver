import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro34-multi-vdd-label.input.json"
import "tests/fixtures/matcher"

const EPS = 1e-6
const MAX_GAP = 0.25
const MIN_OVERLAP = 0.05

function countDoubleLines(traces: any[]): number {
  const byNet = new Map<string, any[]>()
  for (const trace of traces) {
    const netId = trace.globalConnNetId ?? trace.dcConnNetId ?? "?"
    const arr = byNet.get(netId)
    if (arr) arr.push(trace)
    else byNet.set(netId, [trace])
  }
  let count = 0
  for (const netTraces of byNet.values()) {
    const segs: Array<{ o: "h" | "v"; f: number; lo: number; hi: number }> = []
    for (const trace of netTraces) {
      const path = trace.tracePath ?? []
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i]!
        const b = path[i + 1]!
        if (Math.abs(a.y - b.y) < EPS && Math.abs(a.x - b.x) > EPS) {
          segs.push({
            o: "h",
            f: a.y,
            lo: Math.min(a.x, b.x),
            hi: Math.max(a.x, b.x),
          })
        } else if (Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) > EPS) {
          segs.push({
            o: "v",
            f: a.x,
            lo: Math.min(a.y, b.y),
            hi: Math.max(a.y, b.y),
          })
        }
      }
    }
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const a = segs[i]!
        const b = segs[j]!
        if (a.o !== b.o) continue
        const gap = Math.abs(a.f - b.f)
        if (gap <= EPS || gap > MAX_GAP) continue
        if (Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo) >= MIN_OVERLAP) count++
      }
    }
  }
  return count
}

const rectOf = (c: { x: number; y: number }, w: number, h: number) => ({
  minX: c.x - w / 2,
  maxX: c.x + w / 2,
  minY: c.y - h / 2,
  maxY: c.y + h / 2,
})

/** Net-label boxes that overlap a chip box (the #34-review regression). */
function countNetLabelChipOverlaps(
  netLabelPlacements: Array<{
    center: { x: number; y: number }
    width: number
    height: number
  }>,
  chips: Array<{
    center: { x: number; y: number }
    width: number
    height: number
  }>,
): number {
  let n = 0
  for (const label of netLabelPlacements) {
    const lb = rectOf(label.center, label.width, label.height)
    for (const chip of chips) {
      const cb = rectOf(chip.center, chip.width, chip.height)
      if (
        lb.minX < cb.maxX - EPS &&
        lb.maxX > cb.minX + EPS &&
        lb.minY < cb.maxY - EPS &&
        lb.maxY > cb.minY + EPS
      )
        n++
    }
  }
  return n
}

// InputProblem from a real @tscircuit/core circuit: IC U1 with VDD1/VDD2/VDD3 on
// one net (DEBUG=Group_doInitialSchematicTraceRender → group-trace-render-input-problem).
test("repro34 multi-VDD net-label double line (issue #34)", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const beforeDoubles = countDoubleLines(
    solver.availableNetOrientationSolver!.traces,
  )
  const afterDoubles = countDoubleLines(
    solver.netLabelTraceCollisionSolver!.getOutput().traces,
  )

  // The same-net double lines are present after net-label orientation...
  expect(beforeDoubles).toBeGreaterThan(0)
  // ...and the merge collapses them — except a collapse is skipped when it would
  // pull the net label onto a chip box (the detour is the label's clearance), so
  // the count drops sharply (here 4 -> 1) while a clearance detour can remain.
  expect(afterDoubles).toBeLessThanOrEqual(1)

  // The reviewer-flagged invariant (rushabhcodes "label overlap with box"): no
  // relocated net-label box may overlap a chip box.
  expect(
    countNetLabelChipOverlaps(
      solver.sameNetTraceMergeSolver!.getOutput().netLabelPlacements,
      solver.inputProblem.chips,
    ),
  ).toBe(0)

  expect(solver.availableNetOrientationSolver!).toMatchSolverSnapshot(
    import.meta.path,
    "repro34-multi-vdd-label-before",
  )
  expect(solver.sameNetTraceMergeSolver!).toMatchSolverSnapshot(
    import.meta.path,
    "repro34-multi-vdd-label-after",
  )
})
