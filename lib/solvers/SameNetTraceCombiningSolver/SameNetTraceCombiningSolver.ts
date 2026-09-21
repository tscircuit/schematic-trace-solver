import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * SameNetTraceCombiningSolver
 *
 * Post-processing phase that detects same-net trace segments routed close
 * together (axis-parallel and within a small orthogonal tolerance) and merges
 * them onto a shared axis. When two same-net traces share a near-coincident
 * run, the visual result is a duplicated parallel line; collapsing them onto
 * a single axis with a junction at the divergence point produces a tree-like
 * trace appearance instead of duplicate parallel segments.
 *
 * Operates only within a single net (grouped by globalConnNetId), so traces
 * from different nets are never merged. Geometry is mutated in place on
 * cloned trace paths; the original solver outputs are not modified.
 *
 * Behavior:
 * 1. Group traces by globalConnNetId.
 * 2. Walk every (segmentA, segmentB) pair where each comes from a different
 *    trace within the same net group.
 * 3. If segments are both horizontal or both vertical, within mergeDistance
 *    on the shared axis, and have overlap >= minOverlap on the parallel
 *    axis, snap segmentB onto segmentA's axis. The shorter segment is the
 *    one that moves so that the longer trace stays anchored.
 * 4. Record a junction point at the boundary where the snapped segment
 *    rejoins the rest of its trace; downstream consumers can render a dot.
 *
 * Tolerances are conservative because the schematic grid in this project
 * places pins at 0.2 increments and the existing TraceOverlapShiftSolver
 * already separates non-same-net overlaps. A merge distance of 0.15 is
 * large enough to capture visible duplication but smaller than one grid
 * unit, so legitimately distinct same-net traces are left alone.
 */

export interface SameNetMergeJunction {
  netId: string
  point: Point
}

export interface SameNetTraceCombiningSolverParams {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  /** Maximum orthogonal distance between two parallel segments to be considered mergeable. */
  mergeDistance?: number
  /** Minimum overlap length along the parallel axis required to merge. */
  minOverlap?: number
}

const DEFAULT_MERGE_DISTANCE = 0.15
const DEFAULT_MIN_OVERLAP = 0.05
const COLLINEAR_EPSILON = 1e-6

type Orientation = "h" | "v" | "p"

interface SegmentRef {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  /** axis-perpendicular coordinate (y for horizontal, x for vertical) */
  axisCoord: number
  /** parallel-axis range [min, max] */
  parStart: number
  parEnd: number
}

function classifySegment(a: Point, b: Point): Orientation {
  if (Math.abs(a.x - b.x) < COLLINEAR_EPSILON) return "v"
  if (Math.abs(a.y - b.y) < COLLINEAR_EPSILON) return "h"
  return "p"
}

function buildSegmentRef(
  trace: SolvedTracePath,
  traceIndex: number,
  segmentIndex: number,
): SegmentRef | null {
  const a = trace.tracePath[segmentIndex]!
  const b = trace.tracePath[segmentIndex + 1]!
  const orientation = classifySegment(a, b)
  if (orientation === "p") return null

  if (orientation === "h") {
    return {
      traceIndex,
      segmentIndex,
      orientation,
      axisCoord: a.y,
      parStart: Math.min(a.x, b.x),
      parEnd: Math.max(a.x, b.x),
    }
  }
  return {
    traceIndex,
    segmentIndex,
    orientation,
    axisCoord: a.x,
    parStart: Math.min(a.y, b.y),
    parEnd: Math.max(a.y, b.y),
  }
}

function segmentLength(s: SegmentRef): number {
  return s.parEnd - s.parStart
}

function overlapLength(a: SegmentRef, b: SegmentRef): number {
  const lo = Math.max(a.parStart, b.parStart)
  const hi = Math.min(a.parEnd, b.parEnd)
  return hi - lo
}

export class SameNetTraceCombiningSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  junctions: SameNetMergeJunction[] = []
  mergeDistance: number
  minOverlap: number

  /** Number of segment merges performed; surfaced for tests/diagnostics. */
  mergeCount = 0

  constructor(params: SameNetTraceCombiningSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.traces
    this.mergeDistance = params.mergeDistance ?? DEFAULT_MERGE_DISTANCE
    this.minOverlap = params.minOverlap ?? DEFAULT_MIN_OVERLAP
    // Deep-clone trace paths so we mutate freely without disturbing upstream solvers.
    this.outputTraces = params.traces.map((t) => ({
      ...t,
      tracePath: t.tracePath.map((p) => ({ x: p.x, y: p.y })),
    }))
  }

  override getConstructorParams(): SameNetTraceCombiningSolverParams {
    return {
      inputProblem: this.inputProblem,
      traces: this.inputTraces,
      mergeDistance: this.mergeDistance,
      minOverlap: this.minOverlap,
    }
  }

  override _step() {
    // Single-pass solver: do all the work in one step.
    const groups = this.groupByNet()
    for (const traceIndices of groups.values()) {
      if (traceIndices.length < 2) continue
      this.combineWithinNet(traceIndices)
    }
    this.solved = true
  }

  private groupByNet(): Map<string, number[]> {
    const groups = new Map<string, number[]>()
    for (let i = 0; i < this.outputTraces.length; i++) {
      const trace = this.outputTraces[i]!
      const netKey = trace.globalConnNetId
      const existing = groups.get(netKey)
      if (existing) {
        existing.push(i)
      } else {
        groups.set(netKey, [i])
      }
    }
    return groups
  }

  private combineWithinNet(traceIndices: number[]) {
    // Collect all axis-aligned segments from the traces in this net.
    const segments: SegmentRef[] = []
    for (const ti of traceIndices) {
      const trace = this.outputTraces[ti]!
      for (let si = 0; si < trace.tracePath.length - 1; si++) {
        const ref = buildSegmentRef(trace, ti, si)
        if (ref) segments.push(ref)
      }
    }

    // Compare every segment pair from distinct traces.
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i]!
        const b = segments[j]!
        if (a.traceIndex === b.traceIndex) continue
        if (a.orientation !== b.orientation) continue

        const orthoDistance = Math.abs(a.axisCoord - b.axisCoord)
        if (orthoDistance < COLLINEAR_EPSILON) continue // already coincident
        if (orthoDistance > this.mergeDistance) continue

        const ov = overlapLength(a, b)
        if (ov < this.minOverlap) continue

        // Snap the shorter segment onto the longer one's axis. This keeps the
        // dominant trace anchored and minimizes downstream re-routing.
        const target = segmentLength(a) >= segmentLength(b) ? a : b
        const moved = target === a ? b : a

        this.snapSegmentToAxis(moved, target.axisCoord)
        moved.axisCoord = target.axisCoord
        this.mergeCount++

        // Record a junction at the closer endpoint of the moved segment.
        // After snapping, that endpoint sits on the merged axis and is where
        // the rest of the moved trace branches off.
        const junctionPoint = this.findJunctionPoint(moved, target)
        if (junctionPoint) {
          this.junctions.push({
            netId: this.outputTraces[moved.traceIndex]!.globalConnNetId,
            point: junctionPoint,
          })
        }
      }
    }
  }

  /**
   * Snap the moved segment's endpoints to the target axis coordinate. The
   * segment is the (segmentIndex, segmentIndex+1) edge of the trace path.
   * If adjacent trace segments share an endpoint with the snapped segment we
   * leave them intact — a small kink is preferable to losing connectivity to
   * the originating pin.
   */
  private snapSegmentToAxis(seg: SegmentRef, axisCoord: number) {
    const trace = this.outputTraces[seg.traceIndex]!
    const path = trace.tracePath
    const a = path[seg.segmentIndex]!
    const b = path[seg.segmentIndex + 1]!
    if (seg.orientation === "h") {
      a.y = axisCoord
      b.y = axisCoord
    } else {
      a.x = axisCoord
      b.x = axisCoord
    }
  }

  /**
   * Choose the endpoint of the moved segment that is closest to the target's
   * range as the junction location — that's where the moved trace re-joins
   * the merged axis.
   */
  private findJunctionPoint(
    moved: SegmentRef,
    target: SegmentRef,
  ): Point | null {
    const trace = this.outputTraces[moved.traceIndex]!
    const a = trace.tracePath[moved.segmentIndex]!
    const b = trace.tracePath[moved.segmentIndex + 1]!
    // Endpoint inside target's parallel range becomes the junction.
    const aPar = moved.orientation === "h" ? a.x : a.y
    const bPar = moved.orientation === "h" ? b.x : b.y
    const aInside = aPar >= target.parStart && aPar <= target.parEnd
    const bInside = bPar >= target.parStart && bPar <= target.parEnd
    if (aInside && !bInside) return { x: a.x, y: a.y }
    if (bInside && !aInside) return { x: b.x, y: b.y }
    if (aInside && bInside) {
      // Both endpoints fall inside the target range — pick the one closer to
      // the target midpoint as the junction.
      const targetMid = (target.parStart + target.parEnd) / 2
      return Math.abs(aPar - targetMid) <= Math.abs(bPar - targetMid)
        ? { x: a.x, y: a.y }
        : { x: b.x, y: b.y }
    }
    return null
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      junctions: this.junctions,
      mergeCount: this.mergeCount,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })
    if (!graphics.lines) graphics.lines = []
    if (!graphics.circles) graphics.circles = []

    for (const trace of this.outputTraces) {
      const line: Line = {
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "blue",
      }
      graphics.lines.push(line)
    }
    for (const j of this.junctions) {
      graphics.circles.push({
        center: j.point,
        radius: 0.05,
        fill: "red",
      })
    }
    return graphics
  }
}
