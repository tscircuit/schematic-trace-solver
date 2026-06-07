import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
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
  }

  override getConstructorParams(): SameNetTraceMergeSolverInput {
    return {
      inputProblem: this.inputProblem,
      traces: this.outputTraces,
      mergeThreshold: this.mergeThreshold,
      minOverlap: this.minOverlap,
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
    for (const t of this.outputTraces) {
      t.tracePath = collapseTightUShapes(
        t.tracePath,
        this.mergeThreshold,
        this.minOverlap,
      )
    }

    const netToTraceIdxs = new Map<string, number[]>()
    this.outputTraces.forEach((t, idx) => {
      const k = this.netKey(t)
      const arr = netToTraceIdxs.get(k)
      if (arr) arr.push(idx)
      else netToTraceIdxs.set(k, [idx])
    })

    for (const [, traceIdxs] of netToTraceIdxs) {
      this.alignNet(traceIdxs, "h")
      this.alignNet(traceIdxs, "v")
    }

    for (const t of this.outputTraces) {
      t.tracePath = simplifyOrthogonalPath(t.tracePath)
    }

    this.solved = true
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

  getOutput() {
    return { traces: this.outputTraces }
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

function collapseTightUShapes<T extends { x: number; y: number }>(
  pts: T[],
  maxGap: number,
  minOverlap: number,
): T[] {
  if (pts.length < 4) return pts

  let pathPts = pts
  let changed = true
  while (changed && pathPts.length >= 4) {
    changed = false
    const out: T[] = []

    for (let i = 0; i < pathPts.length; ) {
      if (
        i + 3 < pathPts.length &&
        isCollapsibleUShape(
          pathPts[i]!,
          pathPts[i + 1]!,
          pathPts[i + 2]!,
          pathPts[i + 3]!,
          maxGap,
          minOverlap,
        )
      ) {
        pushPointIfNew(out, pathPts[i]!)
        pushPointIfNew(out, pathPts[i + 3]!)
        i += 3
        changed = true
        continue
      }

      pushPointIfNew(out, pathPts[i]!)
      i++
    }

    pathPts = out
  }

  return pathPts
}

function isCollapsibleUShape<T extends { x: number; y: number }>(
  a: T,
  b: T,
  c: T,
  d: T,
  maxGap: number,
  minOverlap: number,
): boolean {
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
