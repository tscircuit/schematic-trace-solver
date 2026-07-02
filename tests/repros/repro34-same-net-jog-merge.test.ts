import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example19.json"
import "tests/fixtures/matcher"

const COORD_EPS = 1e-6

type Pt = { x: number; y: number }

/**
 * Counts issue-#34 artifacts: pairs of same-net, same-orientation segments
 * whose perpendicular offset is small-but-nonzero (a visible "jog") and
 * whose parallel ranges overlap or touch.
 */
const countSameNetJogs = (traces: any[], maxOffset: number): number => {
  const segs: Array<{
    net: string
    o: "h" | "v"
    c: number
    lo: number
    hi: number
  }> = []
  for (const t of traces) {
    const path: Pt[] = t.tracePath
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i]!
      const b = path[i + 1]!
      if (Math.abs(a.y - b.y) < COORD_EPS && Math.abs(a.x - b.x) > COORD_EPS) {
        segs.push({
          net: t.globalConnNetId,
          o: "h",
          c: a.y,
          lo: Math.min(a.x, b.x),
          hi: Math.max(a.x, b.x),
        })
      } else if (
        Math.abs(a.x - b.x) < COORD_EPS &&
        Math.abs(a.y - b.y) > COORD_EPS
      ) {
        segs.push({
          net: t.globalConnNetId,
          o: "v",
          c: a.x,
          lo: Math.min(a.y, b.y),
          hi: Math.max(a.y, b.y),
        })
      }
    }
  }
  let jogs = 0
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const A = segs[i]!
      const B = segs[j]!
      if (A.net !== B.net || A.o !== B.o) continue
      const off = Math.abs(A.c - B.c)
      if (off < COORD_EPS || off > maxOffset) continue
      const overlap = Math.min(A.hi, B.hi) - Math.max(A.lo, B.lo)
      if (overlap > -COORD_EPS) jogs++
    }
  }
  return jogs
}

test("repro34: same-net near-collinear segments are merged onto a shared axis", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces

  // Before the fix, example19 had two mergeable jogs well below the 0.1
  // paddingBuffer threshold:
  //  - connectivity_net2: verticals at x=3.6 vs x=3.5256 (offset 0.0744)
  //    joining at shared pin JP5.1
  //  - connectivity_net1: horizontals at y=1.3003 vs y=1.3012 (offset 0.0009)
  // (0.09 rather than 0.1: connectivity_net3 has a legitimate step of
  // exactly 0.1 between two pin-anchored runs at y=-0.1 and y=-0.2, which
  // the merge pass intentionally preserves — see the anchor assertion below.)
  expect(countSameNetJogs(traces, 0.09)).toBe(0)

  // The specific canonical case from the issue thread: both net2 verticals
  // must now sit on the same x.
  const net2 = traces.filter(
    (t: any) => t.globalConnNetId === "connectivity_net2",
  )
  const verticalXs = new Set<number>()
  for (const t of net2) {
    const path: Pt[] = t.tracePath
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i]!
      const b = path[i + 1]!
      if (
        Math.abs(a.x - b.x) < COORD_EPS &&
        Math.abs(a.y - b.y) > 0.5 // only the long vertical runs
      ) {
        verticalXs.add(Math.round(a.x * 1e6) / 1e6)
      }
    }
  }
  expect(verticalXs.size).toBe(1)

  // Legitimate steps must be preserved: pins at genuinely different
  // coordinates still need a step somewhere (anchored-conflict cases).
  // connectivity_net3 connects pins at y=-0.1 and y=-0.2 — its step of
  // exactly 0.1 must NOT be flattened, since both runs are pin-anchored.
  const net3 = traces.filter(
    (t: any) => t.globalConnNetId === "connectivity_net3",
  )
  const net3Ys = new Set<number>()
  for (const t of net3) {
    for (const p of t.tracePath as Pt[]) {
      net3Ys.add(Math.round(p.y * 1e6) / 1e6)
    }
  }
  expect(net3Ys.has(-0.1)).toBe(true)
  expect(net3Ys.has(-0.2)).toBe(true)
})
