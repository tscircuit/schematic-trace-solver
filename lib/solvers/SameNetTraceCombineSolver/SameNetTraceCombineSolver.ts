import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import type { Point } from "@tscircuit/math-utils"

const EPS = 2e-3

type Orient = "h" | "v"

interface SegmentInfo {
  traceIdx: number
  segIdx: number
  orient: Orient
  /** y for horizontal, x for vertical */
  axisCoord: number
  /** lower endpoint along segment direction (x for h, y for v) */
  min: number
  /** upper endpoint along segment direction */
  max: number
}

/**
 * Combines same-net trace segments that are close together.
 *
 * After `SchematicTraceLinesSolver` and `LongDistancePairSolver`, a single net
 * may be drawn as multiple parallel `SolvedTracePath`s. When two parallel
 * orthogonal segments on the same net run within `closeDistanceThreshold` of
 * one another and their projections overlap along the segment's direction,
 * they're visually redundant. This solver snaps them to a shared axis so the
 * net renders as a single trace instead of a pair of parallel lines.
 *
 * Only interior segments (segments not touching a pin and whose adjacent
 * segments are perpendicular) are shifted, so pin connectivity is preserved.
 */
export class SameNetTraceCombineSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: SolvedTracePath[]
  combinedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}
  closeDistanceThreshold: number

  constructor(params: {
    inputProblem: InputProblem
    inputTracePaths: SolvedTracePath[]
    closeDistanceThreshold?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.inputTracePaths
    this.closeDistanceThreshold = params.closeDistanceThreshold ?? 0.2

    for (const tracePath of this.inputTracePaths) {
      this.combinedTraceMap[tracePath.mspPairId] = {
        ...tracePath,
        tracePath: tracePath.tracePath.map((p) => ({ ...p })),
      }
    }

    // Bound work: at most this many merge attempts overall.
    this.MAX_ITERATIONS = Math.max(
      100,
      this.inputTracePaths.reduce((s, t) => s + t.tracePath.length, 0) * 4,
    )
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceCombineSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTracePaths: this.inputTracePaths,
      closeDistanceThreshold: this.closeDistanceThreshold,
    }
  }

  private static overlap1D(
    a1: number,
    a2: number,
    b1: number,
    b2: number,
  ): number {
    const minA = Math.min(a1, a2)
    const maxA = Math.max(a1, a2)
    const minB = Math.min(b1, b2)
    const maxB = Math.max(b1, b2)
    return Math.min(maxA, maxB) - Math.max(minA, minB)
  }

  private collectSegments(traces: SolvedTracePath[]): SegmentInfo[] {
    const segments: SegmentInfo[] = []
    for (let t = 0; t < traces.length; t++) {
      const pts = traces[t]!.tracePath
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i]!
        const p2 = pts[i + 1]!
        const dx = Math.abs(p1.x - p2.x)
        const dy = Math.abs(p1.y - p2.y)
        // skip degenerate / diagonal segments
        if (dy < EPS && dx >= EPS) {
          segments.push({
            traceIdx: t,
            segIdx: i,
            orient: "h",
            axisCoord: (p1.y + p2.y) / 2,
            min: Math.min(p1.x, p2.x),
            max: Math.max(p1.x, p2.x),
          })
        } else if (dx < EPS && dy >= EPS) {
          segments.push({
            traceIdx: t,
            segIdx: i,
            orient: "v",
            axisCoord: (p1.x + p2.x) / 2,
            min: Math.min(p1.y, p2.y),
            max: Math.max(p1.y, p2.y),
          })
        }
      }
    }
    return segments
  }

  private canShiftInteriorSegment(
    trace: SolvedTracePath,
    segIdx: number,
    orient: Orient,
  ): boolean {
    const pts = trace.tracePath
    // Need a previous and next segment (so endpoints are anchored to elbows,
    // not pins). This keeps pin connectivity intact.
    if (segIdx <= 0 || segIdx >= pts.length - 2) return false
    const prev1 = pts[segIdx - 1]!
    const prev2 = pts[segIdx]!
    const next1 = pts[segIdx + 1]!
    const next2 = pts[segIdx + 2]!
    if (orient === "h") {
      // Adjacent segments must be vertical to absorb a y shift.
      if (Math.abs(prev1.x - prev2.x) > EPS) return false
      if (Math.abs(next1.x - next2.x) > EPS) return false
    } else {
      if (Math.abs(prev1.y - prev2.y) > EPS) return false
      if (Math.abs(next1.y - next2.y) > EPS) return false
    }
    return true
  }

  private shiftSegmentTo(
    trace: SolvedTracePath,
    segIdx: number,
    orient: Orient,
    target: number,
  ) {
    const pts = trace.tracePath
    const p1 = pts[segIdx]!
    const p2 = pts[segIdx + 1]!
    if (orient === "h") {
      p1.y = target
      p2.y = target
    } else {
      p1.x = target
      p2.x = target
    }
  }

  /** Remove zero-length segments and collinear interior points. */
  private simplifyPath(path: Point[]): Point[] {
    if (path.length < 2) return path
    // Drop consecutive duplicate points.
    const dedup: Point[] = [path[0]!]
    for (let i = 1; i < path.length; i++) {
      const prev = dedup[dedup.length - 1]!
      const p = path[i]!
      if (Math.abs(prev.x - p.x) < EPS && Math.abs(prev.y - p.y) < EPS) continue
      dedup.push(p)
    }
    if (dedup.length < 3) return dedup
    // Drop colinear midpoints (interior point where prev->cur and cur->next
    // share the same horizontal/vertical orientation).
    const result: Point[] = [dedup[0]!]
    for (let i = 1; i < dedup.length - 1; i++) {
      const a = result[result.length - 1]!
      const b = dedup[i]!
      const c = dedup[i + 1]!
      const abH = Math.abs(a.y - b.y) < EPS
      const abV = Math.abs(a.x - b.x) < EPS
      const bcH = Math.abs(b.y - c.y) < EPS
      const bcV = Math.abs(b.x - c.x) < EPS
      // Same orientation and not a degenerate corner → drop b.
      if ((abH && bcH) || (abV && bcV)) continue
      result.push(b)
    }
    result.push(dedup[dedup.length - 1]!)
    return result
  }

  /**
   * Find the next pair of same-net parallel segments running within
   * `closeDistanceThreshold` and overlapping along their direction, where at
   * least one of the two is an interior segment that can safely be shifted.
   */
  private findNextCloseSegmentPair(): {
    netTraces: SolvedTracePath[]
    a: SegmentInfo
    b: SegmentInfo
  } | null {
    const allTraces = Object.values(this.combinedTraceMap)
    const byNet: Record<string, SolvedTracePath[]> = {}
    for (const trace of allTraces) {
      const key = trace.globalConnNetId
      ;(byNet[key] ??= []).push(trace)
    }

    let best: {
      netTraces: SolvedTracePath[]
      a: SegmentInfo
      b: SegmentInfo
      distance: number
    } | null = null

    for (const netId of Object.keys(byNet)) {
      const netTraces = byNet[netId]!
      if (netTraces.length < 2) continue
      const segments = this.collectSegments(netTraces)
      for (let i = 0; i < segments.length; i++) {
        const a = segments[i]!
        for (let j = i + 1; j < segments.length; j++) {
          const b = segments[j]!
          if (a.orient !== b.orient) continue
          if (a.traceIdx === b.traceIdx) continue
          const distance = Math.abs(a.axisCoord - b.axisCoord)
          if (distance < EPS) continue // already shared
          if (distance > this.closeDistanceThreshold) continue
          if (SameNetTraceCombineSolver.overlap1D(a.min, a.max, b.min, b.max) <= EPS)
            continue
          const aShiftable = this.canShiftInteriorSegment(
            netTraces[a.traceIdx]!,
            a.segIdx,
            a.orient,
          )
          const bShiftable = this.canShiftInteriorSegment(
            netTraces[b.traceIdx]!,
            b.segIdx,
            b.orient,
          )
          if (!aShiftable && !bShiftable) continue
          if (best === null || distance < best.distance) {
            best = { netTraces, a, b, distance }
          }
        }
      }
    }

    return best
  }

  override _step() {
    const found = this.findNextCloseSegmentPair()
    if (!found) {
      this.solved = true
      return
    }
    const { netTraces, a, b } = found
    const traceA = netTraces[a.traceIdx]!
    const traceB = netTraces[b.traceIdx]!
    const aShiftable = this.canShiftInteriorSegment(traceA, a.segIdx, a.orient)
    const bShiftable = this.canShiftInteriorSegment(traceB, b.segIdx, b.orient)

    let target: number
    if (aShiftable && bShiftable) {
      target = (a.axisCoord + b.axisCoord) / 2
    } else if (aShiftable) {
      target = b.axisCoord
    } else {
      target = a.axisCoord
    }

    if (aShiftable) this.shiftSegmentTo(traceA, a.segIdx, a.orient, target)
    if (bShiftable) this.shiftSegmentTo(traceB, b.segIdx, b.orient, target)

    // Simplify paths in case the shift produced zero-length neighbor segments
    // or made adjacent segments colinear.
    traceA.tracePath = this.simplifyPath(traceA.tracePath)
    if (traceB !== traceA) {
      traceB.tracePath = this.simplifyPath(traceB.tracePath)
    }
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: Object.values(this.combinedTraceMap) }
  }

  override visualize() {
    const graphics = visualizeInputProblem(this.inputProblem)
    graphics.lines = graphics.lines || []
    for (const trace of Object.values(this.combinedTraceMap)) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }
    return graphics
  }
}
