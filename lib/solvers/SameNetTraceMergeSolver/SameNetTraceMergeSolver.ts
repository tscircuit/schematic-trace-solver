import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { GraphicsObject } from "graphics-debug"

interface SameNetTraceMergeSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  /**
   * Maximum perpendicular distance between two parallel same-net segments
   * for them to be considered close enough to merge into a single segment.
   */
  gapThreshold?: number
}

const ORIENT_EPS = 1e-6
const DUP_EPS = 1e-6

/**
 * Combines schematic trace segments that belong to the same global net and
 * run parallel within a small perpendicular gap. The two parallel segments
 * are snapped onto a shared coordinate so they visually collapse into one
 * line, eliminating the "double trace" artifact while preserving the
 * connectivity and the pin endpoints of the original paths.
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  gapThreshold: number

  constructor(input: SameNetTraceMergeSolverInput) {
    super()
    this.inputProblem = input.inputProblem
    this.traces = input.traces.map((t) => ({
      ...t,
      tracePath: t.tracePath.map((p) => ({ x: p.x, y: p.y })),
    }))
    this.gapThreshold = input.gapThreshold ?? 0.15
    this.MAX_ITERATIONS = 1000
  }

  override _step() {
    const merged = this.findAndMergeNextPair()
    if (!merged) {
      for (const trace of this.traces) {
        trace.tracePath = collapseColinearPoints(trace.tracePath)
      }
      this.solved = true
    }
  }

  private findAndMergeNextPair(): boolean {
    const netGroups = new Map<string, number[]>()
    for (let i = 0; i < this.traces.length; i++) {
      const t = this.traces[i]!
      if (!netGroups.has(t.globalConnNetId))
        netGroups.set(t.globalConnNetId, [])
      netGroups.get(t.globalConnNetId)!.push(i)
    }

    for (const indices of netGroups.values()) {
      if (indices.length < 2) continue
      for (let ii = 0; ii < indices.length; ii++) {
        for (let jj = ii + 1; jj < indices.length; jj++) {
          if (this.tryMergeTraces(indices[ii]!, indices[jj]!)) return true
        }
      }
    }
    return false
  }

  private tryMergeTraces(aIdx: number, bIdx: number): boolean {
    const ta = this.traces[aIdx]!
    const tb = this.traces[bIdx]!

    for (let sa = 0; sa < ta.tracePath.length - 1; sa++) {
      const orientA = segmentOrientation(
        ta.tracePath[sa]!,
        ta.tracePath[sa + 1]!,
      )
      if (!orientA) continue

      for (let sb = 0; sb < tb.tracePath.length - 1; sb++) {
        const orientB = segmentOrientation(
          tb.tracePath[sb]!,
          tb.tracePath[sb + 1]!,
        )
        if (orientA !== orientB) continue

        const merged = this.tryMergeSegments(aIdx, sa, bIdx, sb, orientA)
        if (merged) return true
      }
    }
    return false
  }

  private tryMergeSegments(
    aIdx: number,
    sa: number,
    bIdx: number,
    sb: number,
    orient: "h" | "v",
  ): boolean {
    const ta = this.traces[aIdx]!
    const tb = this.traces[bIdx]!
    const a1 = ta.tracePath[sa]!
    const a2 = ta.tracePath[sa + 1]!
    const b1 = tb.tracePath[sb]!
    const b2 = tb.tracePath[sb + 1]!

    const perpAxis: "x" | "y" = orient === "h" ? "y" : "x"
    const longAxis: "x" | "y" = orient === "h" ? "x" : "y"

    const gap = Math.abs(a1[perpAxis] - b1[perpAxis])
    if (gap <= DUP_EPS) return false
    if (gap > this.gapThreshold) return false

    const aLo = Math.min(a1[longAxis], a2[longAxis])
    const aHi = Math.max(a1[longAxis], a2[longAxis])
    const bLo = Math.min(b1[longAxis], b2[longAxis])
    const bHi = Math.max(b1[longAxis], b2[longAxis])
    const overlap = Math.min(aHi, bHi) - Math.max(aLo, bLo)
    if (overlap <= DUP_EPS) return false

    const aPinned = isSegmentEndpointPinned(ta, sa)
    const bPinned = isSegmentEndpointPinned(tb, sb)

    let target: number
    if (aPinned && bPinned) return false
    if (aPinned) target = a1[perpAxis]
    else if (bPinned) target = b1[perpAxis]
    else target = (a1[perpAxis] + b1[perpAxis]) / 2

    if (!canShiftSegment(ta, sa, perpAxis, target)) return false
    if (!canShiftSegment(tb, sb, perpAxis, target)) return false

    shiftSegment(ta, sa, perpAxis, target)
    shiftSegment(tb, sb, perpAxis, target)
    return true
  }

  getOutput() {
    return { traces: this.traces }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })
    graphics.lines = graphics.lines || []
    for (const trace of this.traces) {
      graphics.lines.push({
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "blue",
      })
    }
    return graphics
  }
}

function segmentOrientation(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): "h" | "v" | null {
  const dx = Math.abs(p1.x - p2.x)
  const dy = Math.abs(p1.y - p2.y)
  if (dy < ORIENT_EPS && dx > ORIENT_EPS) return "h"
  if (dx < ORIENT_EPS && dy > ORIENT_EPS) return "v"
  return null
}

/**
 * The first and last points of every trace path are pin positions and must
 * remain anchored. A segment that touches either endpoint cannot have its
 * perpendicular coordinate moved away from the pin.
 */
function isSegmentEndpointPinned(
  trace: SolvedTracePath,
  segIdx: number,
): boolean {
  return segIdx === 0 || segIdx + 1 === trace.tracePath.length - 1
}

/**
 * Confirms that shifting the perpendicular coordinate of a segment will not
 * disconnect the path: both adjacent segments must remain orthogonal after
 * the shift (an adjacent segment that runs along the perpendicular axis
 * would lose its link to the moved endpoint).
 */
function canShiftSegment(
  trace: SolvedTracePath,
  segIdx: number,
  perpAxis: "x" | "y",
  target: number,
): boolean {
  const path = trace.tracePath
  const p1 = path[segIdx]!
  const p2 = path[segIdx + 1]!
  const longAxis = perpAxis === "x" ? "y" : "x"

  const moveStart = !(segIdx === 0)
  const moveEnd = !(segIdx + 1 === path.length - 1)

  if (!moveStart && Math.abs(p1[perpAxis] - target) > DUP_EPS) return false
  if (!moveEnd && Math.abs(p2[perpAxis] - target) > DUP_EPS) return false

  if (moveStart && segIdx > 0) {
    const prev = path[segIdx - 1]!
    if (Math.abs(prev[longAxis] - p1[longAxis]) > ORIENT_EPS) return false
  }
  if (moveEnd && segIdx + 2 < path.length) {
    const next = path[segIdx + 2]!
    if (Math.abs(next[longAxis] - p2[longAxis]) > ORIENT_EPS) return false
  }
  return true
}

function shiftSegment(
  trace: SolvedTracePath,
  segIdx: number,
  perpAxis: "x" | "y",
  target: number,
) {
  const path = trace.tracePath
  if (segIdx !== 0) path[segIdx]![perpAxis] = target
  if (segIdx + 1 !== path.length - 1) path[segIdx + 1]![perpAxis] = target
}

function collapseColinearPoints(
  path: { x: number; y: number }[],
): { x: number; y: number }[] {
  if (path.length < 3) return path
  const result: { x: number; y: number }[] = [path[0]!]
  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1]!
    const cur = path[i]!
    const next = path[i + 1]!
    if (
      Math.abs(prev.x - cur.x) < DUP_EPS &&
      Math.abs(cur.x - next.x) < DUP_EPS
    )
      continue
    if (
      Math.abs(prev.y - cur.y) < DUP_EPS &&
      Math.abs(cur.y - next.y) < DUP_EPS
    )
      continue
    result.push(cur)
  }
  result.push(path[path.length - 1]!)
  return result
}
