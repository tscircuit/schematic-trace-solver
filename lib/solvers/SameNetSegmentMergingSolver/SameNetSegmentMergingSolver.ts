import type { GraphicsObject } from "graphics-debug"
import type { Point } from "@tscircuit/math-utils"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"
import {
  isHorizontal,
  isVertical,
} from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

const EPS = 1e-6
const DEFAULT_GAP_THRESHOLD = 0.15
const MAX_PASSES = 10

/**
 * A pipeline phase that finds same-net trace segments that are close together
 * and snaps them to align, reducing visual clutter in schematic diagrams.
 *
 * For each net, segments from different traces are compared. When two parallel
 * segments of the same net are within GAP_THRESHOLD of each other and overlap
 * along their primary axis, the movable one(s) are shifted to match the anchored
 * (or weighted-average) coordinate.
 */
export class SameNetSegmentMergingSolver extends BaseSolver {
  inputProblem: InputProblem
  gapThreshold: number
  outputTraces: SolvedTracePath[]

  constructor(params: {
    inputProblem: InputProblem
    allTraces: SolvedTracePath[]
    gapThreshold?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.gapThreshold = params.gapThreshold ?? DEFAULT_GAP_THRESHOLD
    // Deep-clone the traces so we never mutate pipeline inputs
    this.outputTraces = params.allTraces.map((trace) => ({
      ...trace,
      tracePath: trace.tracePath.map((p) => ({ ...p })),
      mspConnectionPairIds: [...trace.mspConnectionPairIds],
      pinIds: [...trace.pinIds],
      pins: trace.pins.map((pin) => ({ ...pin })) as typeof trace.pins,
    }))
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetSegmentMergingSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      allTraces: this.outputTraces,
      gapThreshold: this.gapThreshold,
    }
  }

  override _step() {
    // Iteratively snap segments until stable
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      if (!this._mergePass()) break
    }

    // Normalize all paths after merging
    for (let i = 0; i < this.outputTraces.length; i++) {
      this.outputTraces[i] = {
        ...this.outputTraces[i]!,
        tracePath: normalizePath(this.outputTraces[i]!.tracePath),
      }
    }

    this.solved = true
  }

  /**
   * One pass over all same-net segment pairs. Returns true if any change was made.
   */
  private _mergePass(): boolean {
    let changed = false

    // Group trace indices by globalConnNetId
    const netToTraceIndices = new Map<string, number[]>()
    for (let i = 0; i < this.outputTraces.length; i++) {
      const netId = this.outputTraces[i]!.globalConnNetId
      if (!netToTraceIndices.has(netId)) {
        netToTraceIndices.set(netId, [])
      }
      netToTraceIndices.get(netId)!.push(i)
    }

    for (const traceIndices of netToTraceIndices.values()) {
      if (traceIndices.length < 2) continue

      for (const orientation of ["horizontal", "vertical"] as const) {
        const segments = this._collectSegments(traceIndices, orientation)

        // Anchored segments: first or last segment of their trace path
        const anchors = segments.filter((s) => !s.canMove)
        const movables = segments.filter((s) => s.canMove)

        // Phase 1: snap movable segments toward anchored segments of the same net
        if (anchors.length > 0 && movables.length > 0) {
          for (const seg of movables) {
            let best: { coord: number; dist: number } | null = null
            for (const anchor of anchors) {
              if (seg.traceIndex === anchor.traceIndex) continue
              if (!segmentsOverlap(seg, anchor)) continue
              const dist = Math.abs(seg.axisCoord - anchor.axisCoord)
              if (dist > this.gapThreshold + EPS) continue
              if (best === null || dist < best.dist) {
                best = { coord: anchor.axisCoord, dist }
              }
            }
            if (best !== null) {
              changed = this._applyMove(seg, best.coord) || changed
            }
          }
        }

        // Phase 2: snap movable segments toward each other (weighted by span)
        const groups = unionFindGroupBy(
          movables,
          (a, b) =>
            a.traceIndex !== b.traceIndex &&
            segmentsOverlap(a, b) &&
            Math.abs(a.axisCoord - b.axisCoord) <= this.gapThreshold + EPS,
        )

        for (const group of groups) {
          if (group.length < 2) continue
          const totalSpan = group.reduce((acc, s) => acc + s.span, 0)
          if (totalSpan < EPS) continue
          const targetCoord =
            group.reduce((acc, s) => acc + s.axisCoord * s.span, 0) / totalSpan
          for (const seg of group) {
            changed = this._applyMove(seg, targetCoord) || changed
          }
        }
      }
    }

    return changed
  }

  /**
   * Collect segment descriptors for all given trace indices, for a given orientation.
   */
  private _collectSegments(
    traceIndices: number[],
    orientation: "horizontal" | "vertical",
  ): SegmentRef[] {
    const segments: SegmentRef[] = []

    for (const traceIndex of traceIndices) {
      const trace = this.outputTraces[traceIndex]!
      const lastIdx = trace.tracePath.length - 1

      for (let si = 0; si < trace.tracePath.length - 1; si++) {
        const a = trace.tracePath[si]!
        const b = trace.tracePath[si + 1]!

        const matches =
          orientation === "horizontal"
            ? isHorizontal(a, b, EPS)
            : isVertical(a, b, EPS)
        if (!matches) continue

        const rangeStart =
          orientation === "horizontal" ? Math.min(a.x, b.x) : Math.min(a.y, b.y)
        const rangeEnd =
          orientation === "horizontal" ? Math.max(a.x, b.x) : Math.max(a.y, b.y)
        const span = rangeEnd - rangeStart
        if (span < EPS) continue

        const axisCoord = orientation === "horizontal" ? a.y : a.x

        // Endpoint segments (si===0 or si===lastIdx-1) are anchors;
        // interior segments can be moved
        const canMove = si > 0 && si + 1 < lastIdx

        segments.push({
          traceIndex,
          segmentIndex: si,
          orientation,
          axisCoord,
          rangeStart,
          rangeEnd,
          span,
          canMove,
        })
      }
    }

    return segments
  }

  /**
   * Shift a segment's perpendicular coordinate to targetCoord.
   * Returns true if the trace was actually modified.
   */
  private _applyMove(seg: SegmentRef, targetCoord: number): boolean {
    if (!seg.canMove) return false
    if (Math.abs(seg.axisCoord - targetCoord) < EPS) return false

    const trace = this.outputTraces[seg.traceIndex]!
    const newPath = trace.tracePath.map((p) => ({ ...p }))
    const pa = newPath[seg.segmentIndex]!
    const pb = newPath[seg.segmentIndex + 1]!

    if (seg.orientation === "horizontal") {
      pa.y = targetCoord
      pb.y = targetCoord
    } else {
      pa.x = targetCoord
      pb.x = targetCoord
    }

    this.outputTraces[seg.traceIndex] = {
      ...trace,
      tracePath: normalizePath(newPath),
    }

    return true
  }

  getOutput() {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    for (const trace of this.outputTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "green",
      })
    }

    return graphics
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

type SegmentRef = {
  traceIndex: number
  segmentIndex: number
  orientation: "horizontal" | "vertical"
  axisCoord: number
  rangeStart: number
  rangeEnd: number
  span: number
  canMove: boolean
}

/** Do two segments' primary-axis ranges overlap (by more than EPS)? */
function segmentsOverlap(a: SegmentRef, b: SegmentRef): boolean {
  const overlap =
    Math.min(a.rangeEnd, b.rangeEnd) - Math.max(a.rangeStart, b.rangeStart)
  return overlap > EPS
}

/**
 * Simple union-find grouping: group items where `related(a, b)` is true.
 */
function unionFindGroupBy<T>(
  items: T[],
  related: (a: T, b: T) => boolean,
): T[][] {
  const parent = items.map((_, i) => i)
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]!)
    return parent[i]!
  }
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (related(items[i]!, items[j]!)) {
        const ri = find(i)
        const rj = find(j)
        if (ri !== rj) parent[rj] = ri
      }
    }
  }
  const groups = new Map<number, T[]>()
  for (let i = 0; i < items.length; i++) {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(items[i]!)
  }
  return Array.from(groups.values())
}

/** Remove duplicate consecutive points, then simplify collinear segments. */
function normalizePath(path: Point[]): Point[] {
  const deduped: Point[] = []
  for (const pt of path) {
    const prev = deduped[deduped.length - 1]
    if (
      prev &&
      Math.abs(prev.x - pt.x) < EPS &&
      Math.abs(prev.y - pt.y) < EPS
    ) {
      continue
    }
    deduped.push({ ...pt })
  }
  if (deduped.length < 3) return deduped

  const simplified = simplifyPath(deduped)
  const result: Point[] = []
  for (const pt of simplified) {
    const prev = result[result.length - 1]
    if (
      prev &&
      Math.abs(prev.x - pt.x) < EPS &&
      Math.abs(prev.y - pt.y) < EPS
    ) {
      continue
    }
    result.push({ ...pt })
  }
  return result
}
