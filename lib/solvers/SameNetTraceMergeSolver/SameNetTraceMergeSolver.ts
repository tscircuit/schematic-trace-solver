import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"

const EPS = 1e-6

export interface SameNetTraceMergeSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  /**
   * Max perpendicular gap between two same-net parallel segments for them to be
   * snapped onto a common line.
   */
  mergeThreshold?: number
  /** Minimum parallel overlap for two segments to count as a redundant double line. */
  minOverlap?: number
  /** Label anchors — U-collapse may skip detours that touch them (see _step). */
  netLabelPlacements?: NetLabelPlacement[]
}

type Orient = "h" | "v"

interface SegRef {
  traceIndex: number
  /** segment spans tracePath[i] -> tracePath[i + 1] */
  i: number
  fixed: number
  lo: number
  hi: number
  /** true if either endpoint is a terminal (pin) point of the trace -> must not move */
  pinned: boolean
}

/**
 * SameNetTraceMergeSolver
 *
 * Collapses redundant "double line" artifacts: two (or more) trace segments that
 * belong to the SAME net, run parallel and axis-aligned, sit a small distance
 * apart, and overlap along their length. The renderer draws these as two lines a
 * hair apart where there should be one (GitHub issues #29 / #34).
 *
 * The TraceOverlapShiftSolver shifts *different* nets apart to avoid coincident
 * overlap; it deliberately leaves same-net parallels alone, which is what produces
 * these doublings. This phase is the complement: for each net it snaps the movable
 * parallel-close segments onto a single shared coordinate ("make them the same Y or
 * same X", per #34) so they coincide and render as one line, then simplifies the
 * paths. It also collapses tight U-shaped detours whose terminal endpoints already
 * lie on a straight orthogonal segment. Connectivity is preserved: terminal (pin)
 * endpoints are never moved.
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  outputTraces: SolvedTracePath[]
  mergeThreshold: number
  minOverlap: number
  netLabelPlacements: NetLabelPlacement[]
  outputNetLabelPlacements: NetLabelPlacement[]

  constructor(params: SameNetTraceMergeSolverInput) {
    super()
    this.inputProblem = params.inputProblem
    // Clone trace paths (and points) so upstream solver outputs are not mutated.
    this.outputTraces = params.traces.map((t) => ({
      ...t,
      tracePath: t.tracePath.map((p) => ({ ...p })),
    }))
    this.mergeThreshold = params.mergeThreshold ?? 0.25
    this.minOverlap = params.minOverlap ?? 0.05
    this.netLabelPlacements = params.netLabelPlacements ?? []
    // Labels may be relocated when a label-lead U detour is collapsed; output a clone.
    this.outputNetLabelPlacements = this.netLabelPlacements.map((l) => ({
      ...l,
      anchorPoint: { ...l.anchorPoint },
      center: { ...l.center },
    }))
  }

  override getConstructorParams(): SameNetTraceMergeSolverInput {
    return {
      inputProblem: this.inputProblem,
      traces: this.outputTraces,
      mergeThreshold: this.mergeThreshold,
      minOverlap: this.minOverlap,
      netLabelPlacements: this.netLabelPlacements,
    }
  }

  private netKey(t: SolvedTracePath): string {
    return (
      t.globalConnNetId ??
      (t as unknown as { dcConnNetId?: string }).dcConnNetId ??
      "?"
    )
  }

  override _step() {
    const netToTraceIdxs = new Map<string, number[]>()
    this.outputTraces.forEach((t, idx) => {
      const k = this.netKey(t)
      const arr = netToTraceIdxs.get(k)
      if (arr) arr.push(idx)
      else netToTraceIdxs.set(k, [idx])
    })

    // Collapse tight U detours. When a detour's apex carries a net-label anchor,
    // the detour IS the connection to that label — so instead of deleting it
    // (which drops the label, the #34-review regression), we collapse it AND
    // relocate the label onto the straightened segment so it stays connected.
    this.collapseUShapesRelocatingLabels()

    for (const [, traceIdxs] of netToTraceIdxs) {
      this.alignNet(traceIdxs, "h")
      this.alignNet(traceIdxs, "v")
      this.alignLabelLeads(traceIdxs)
    }

    for (const t of this.outputTraces) {
      t.tracePath = simplifyOrthogonalPath(t.tracePath)
    }

    this.solved = true
  }

  /**
   * Collapse a net-label lead-in that runs parallel-close to another same-net
   * segment ("spine"). A lead routed as an L — jog away from the spine, then a
   * long arm up/across to the label — leaves that long arm a hair to the side of
   * the spine, which renders as a redundant double line (issue #34, the case the
   * net-label-orientation phase reintroduces after the parallel-segment snap).
   *
   * The fix slides the lead's single bend to the label end so the long arm lands
   * ON the spine coordinate and the jog happens next to the label instead. Both
   * endpoints (the spine junction and the label anchor) are left exactly where
   * they were, so connectivity is preserved.
   */
  private alignLabelLeads(traceIdxs: number[]) {
    interface Seg {
      traceIndex: number
      ax: number
      ay: number
      bx: number
      by: number
    }
    const spineSegs: Seg[] = []
    for (const traceIndex of traceIdxs) {
      const p = this.outputTraces[traceIndex]!.tracePath
      for (let i = 0; i < p.length - 1; i++) {
        spineSegs.push({
          traceIndex,
          ax: p[i]!.x,
          ay: p[i]!.y,
          bx: p[i + 1]!.x,
          by: p[i + 1]!.y,
        })
      }
    }

    for (const traceIndex of traceIdxs) {
      const p = this.outputTraces[traceIndex]!.tracePath
      // Only simple L-shaped leads: start (spine junction) -> bend -> end (label).
      if (p.length !== 3) continue
      const a = p[0]!
      const bend = p[1]!
      const end = p[2]!
      const armVert =
        Math.abs(bend.x - end.x) < EPS && Math.abs(bend.y - end.y) > EPS
      const armHorz =
        Math.abs(bend.y - end.y) < EPS && Math.abs(bend.x - end.x) > EPS

      for (const s of spineSegs) {
        if (s.traceIndex === traceIndex) continue
        const sVert = Math.abs(s.ax - s.bx) < EPS && Math.abs(s.ay - s.by) > EPS
        const sHorz = Math.abs(s.ay - s.by) < EPS && Math.abs(s.ax - s.bx) > EPS

        if (armVert && sVert) {
          const gap = Math.abs(bend.x - s.ax)
          if (gap <= EPS || gap > this.mergeThreshold) continue
          const overlap =
            Math.min(Math.max(bend.y, end.y), Math.max(s.ay, s.by)) -
            Math.max(Math.min(bend.y, end.y), Math.min(s.ay, s.by))
          if (overlap < this.minOverlap) continue
          // The lead must start on the spine line, so the slid jog stays orthogonal.
          if (Math.abs(a.x - s.ax) > EPS) continue
          bend.x = s.ax
          bend.y = end.y
          break
        } else if (armHorz && sHorz) {
          const gap = Math.abs(bend.y - s.ay)
          if (gap <= EPS || gap > this.mergeThreshold) continue
          const overlap =
            Math.min(Math.max(bend.x, end.x), Math.max(s.ax, s.bx)) -
            Math.max(Math.min(bend.x, end.x), Math.min(s.ax, s.bx))
          if (overlap < this.minOverlap) continue
          if (Math.abs(a.y - s.ay) > EPS) continue
          bend.y = s.ay
          bend.x = end.x
          break
        }
      }
    }
  }

  /**
   * For one net + orientation: cluster parallel-close overlapping segments and snap
   * the movable ones onto the coordinate of the longest segment in each cluster.
   */
  private alignNet(traceIdxs: number[], orient: Orient) {
    const segs: SegRef[] = []
    for (const traceIndex of traceIdxs) {
      const p = this.outputTraces[traceIndex]!.tracePath
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i]!
        const b = p[i + 1]!
        const horz = Math.abs(a.y - b.y) < EPS && Math.abs(a.x - b.x) > EPS
        const vert = Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) > EPS
        if (orient === "h" ? !horz : !vert) continue
        segs.push({
          traceIndex,
          i,
          fixed: orient === "h" ? a.y : a.x,
          lo: orient === "h" ? Math.min(a.x, b.x) : Math.min(a.y, b.y),
          hi: orient === "h" ? Math.max(a.x, b.x) : Math.max(a.y, b.y),
          pinned: i === 0 || i + 1 === p.length - 1,
        })
      }
    }
    if (segs.length < 2) return

    // Union-find over the "mergeable" relation (parallel-close + overlapping).
    const parent = segs.map((_, i) => i)
    const find = (x: number): number =>
      parent[x] === x ? x : (parent[x] = find(parent[x]!))
    const union = (x: number, y: number) => {
      parent[find(x)] = find(y)
    }
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const a = segs[i]!
        const b = segs[j]!
        const off = Math.abs(a.fixed - b.fixed)
        if (off <= EPS || off > this.mergeThreshold) continue
        const overlap = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo)
        if (overlap < this.minOverlap) continue
        union(i, j)
      }
    }

    const clusters = new Map<number, number[]>()
    for (let i = 0; i < segs.length; i++) {
      const root = find(i)
      const arr = clusters.get(root)
      if (arr) arr.push(i)
      else clusters.set(root, [i])
    }

    for (const [, members] of clusters) {
      if (members.length < 2) continue
      // Target coordinate = the longest segment in the cluster (the "main" line).
      let target = segs[members[0]!]!.fixed
      let bestLen = -1
      for (const m of members) {
        const s = segs[m]!
        const len = s.hi - s.lo
        if (len > bestLen) {
          bestLen = len
          target = s.fixed
        }
      }
      for (const m of members) {
        const s = segs[m]!
        if (s.pinned) continue
        if (Math.abs(s.fixed - target) <= EPS) continue
        const p = this.outputTraces[s.traceIndex]!.tracePath
        if (orient === "h") {
          p[s.i]!.y = target
          p[s.i + 1]!.y = target
        } else {
          p[s.i]!.x = target
          p[s.i + 1]!.x = target
        }
      }
    }
  }

  /**
   * Collapse tight U-shaped detours. When a detour's apex carries a net-label
   * anchor, the detour IS that label's connection — so we collapse it to the
   * straight segment AND relocate the label onto that segment (instead of
   * deleting the detour and dropping the connection, the #34-review regression).
   */
  private collapseUShapesRelocatingLabels() {
    for (const t of this.outputTraces) {
      let pathPts = t.tracePath
      let changed = true
      while (changed && pathPts.length >= 4) {
        changed = false
        const out: typeof pathPts = []
        for (let i = 0; i < pathPts.length; ) {
          if (
            i + 3 < pathPts.length &&
            isCollapsibleUShape(
              pathPts[i]!,
              pathPts[i + 1]!,
              pathPts[i + 2]!,
              pathPts[i + 3]!,
              this.mergeThreshold,
              this.minOverlap,
            )
          ) {
            const a = pathPts[i]!
            const b = pathPts[i + 1]!
            const c = pathPts[i + 2]!
            const d = pathPts[i + 3]!
            this.relocateLabelForCollapsedU(a, b, c, d)
            pushPointIfNew(out, a)
            pushPointIfNew(out, d)
            i += 3
            changed = true
            continue
          }
          pushPointIfNew(out, pathPts[i]!)
          i++
        }
        pathPts = out
      }
      t.tracePath = pathPts
    }
  }

  /**
   * A U [a,b,c,d] is being collapsed to the straight segment a->d (the detour
   * b,c is removed). Any net-label anchor that sat on the removed geometry (the
   * arms a-b / c-d or the apex b-c) would be left floating, so project it onto
   * a->d and shift the label box by the same delta — keeping the label connected.
   */
  private relocateLabelForCollapsedU(
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
    d: { x: number; y: number },
  ) {
    const verticalCollapse = Math.abs(a.x - d.x) < EPS
    for (const label of this.outputNetLabelPlacements) {
      const anc = label.anchorPoint
      const onRemoved =
        pointOnSegment(anc, a, b) ||
        pointOnSegment(anc, b, c) ||
        pointOnSegment(anc, c, d)
      if (!onRemoved) continue
      let newX = anc.x
      let newY = anc.y
      if (verticalCollapse) {
        newX = a.x
        newY = clamp(anc.y, Math.min(a.y, d.y), Math.max(a.y, d.y))
      } else {
        newY = a.y
        newX = clamp(anc.x, Math.min(a.x, d.x), Math.max(a.x, d.x))
      }
      const dx = newX - anc.x
      const dy = newY - anc.y
      if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) continue
      label.anchorPoint = { x: newX, y: newY }
      label.center = { x: label.center.x + dx, y: label.center.y + dy }
    }
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      netLabelPlacements: this.outputNetLabelPlacements,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })
    graphics.lines = graphics.lines ?? []
    for (const trace of this.outputTraces) {
      graphics.lines.push({
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "blue",
      })
    }
    return graphics
  }
}

function isCollapsibleUShape<T extends { x: number; y: number }>(
  a: T,
  b: T,
  c: T,
  d: T,
  maxGap: number,
  minOverlap: number,
  netLabelPlacements: NetLabelPlacement[] = [],
): boolean {
  if (
    isNearNetLabelAnchor(b, netLabelPlacements) ||
    isNearNetLabelAnchor(c, netLabelPlacements)
  ) {
    return false
  }

  const abH = sameY(a, b) && !sameX(a, b)
  const bcV = sameX(b, c) && !sameY(b, c)
  const cdH = sameY(c, d) && !sameX(c, d)
  if (abH && bcV && cdH && sameX(a, d)) {
    const gap = Math.abs(a.y - d.y)
    const overlap =
      Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) -
      Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x))
    return gap > EPS && gap <= maxGap && overlap >= minOverlap
  }

  const abV = sameX(a, b) && !sameY(a, b)
  const bcH = sameY(b, c) && !sameX(b, c)
  const cdV = sameX(c, d) && !sameY(c, d)
  if (abV && bcH && cdV && sameY(a, d)) {
    const gap = Math.abs(a.x - d.x)
    const overlap =
      Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) -
      Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y))
    return gap > EPS && gap <= maxGap && overlap >= minOverlap
  }

  return false
}

function pushPointIfNew<T extends { x: number; y: number }>(pts: T[], p: T) {
  const prev = pts[pts.length - 1]
  if (!prev || !samePoint(prev, p)) pts.push(p)
}

function samePoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return sameX(a, b) && sameY(a, b)
}

function sameX(a: { x: number }, b: { x: number }) {
  return Math.abs(a.x - b.x) < EPS
}

function sameY(a: { y: number }, b: { y: number }) {
  return Math.abs(a.y - b.y) < EPS
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/** Is point p on the axis-aligned segment u->v (within EPS)? */
function pointOnSegment(
  p: { x: number; y: number },
  u: { x: number; y: number },
  v: { x: number; y: number },
): boolean {
  if (Math.abs(u.x - v.x) < EPS) {
    return (
      Math.abs(p.x - u.x) < EPS &&
      p.y >= Math.min(u.y, v.y) - EPS &&
      p.y <= Math.max(u.y, v.y) + EPS
    )
  }
  if (Math.abs(u.y - v.y) < EPS) {
    return (
      Math.abs(p.y - u.y) < EPS &&
      p.x >= Math.min(u.x, v.x) - EPS &&
      p.x <= Math.max(u.x, v.x) + EPS
    )
  }
  return false
}

function isNearNetLabelAnchor(
  p: { x: number; y: number },
  netLabelPlacements: NetLabelPlacement[],
): boolean {
  for (const label of netLabelPlacements) {
    const a = label.anchorPoint
    if (sameX(p, a) && sameY(p, a)) return true
  }
  return false
}

/** Remove duplicate + axis-collinear points (and backtrack spikes) from an orthogonal polyline. */
function simplifyOrthogonalPath<T extends { x: number; y: number }>(
  pts: T[],
): T[] {
  if (pts.length <= 2) return pts
  const dedup: T[] = [pts[0]!]
  for (let k = 1; k < pts.length; k++) {
    const prev = dedup[dedup.length - 1]!
    if (
      Math.abs(pts[k]!.x - prev.x) > EPS ||
      Math.abs(pts[k]!.y - prev.y) > EPS
    ) {
      dedup.push(pts[k]!)
    }
  }
  let pathPts = dedup
  let changed = true
  while (changed && pathPts.length > 2) {
    changed = false
    const out: T[] = [pathPts[0]!]
    for (let k = 1; k < pathPts.length - 1; k++) {
      const a = out[out.length - 1]!
      const b = pathPts[k]!
      const c = pathPts[k + 1]!
      const sameX = Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS
      const sameY = Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS
      if (sameX || sameY) {
        changed = true
        continue // b is redundant (collinear run or backtrack spike)
      }
      out.push(b)
    }
    const last = pathPts[pathPts.length - 1]!
    const tail = out[out.length - 1]!
    if (Math.abs(tail.x - last.x) > EPS || Math.abs(tail.y - last.y) > EPS)
      out.push(last)
    pathPts = out
  }
  return pathPts
}
