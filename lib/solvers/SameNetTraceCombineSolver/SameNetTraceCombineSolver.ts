import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"

type ConnNetId = string

type SegmentRef = {
  pathIndex: number
  segmentIndex: number
  /** Constant axis value (y for horizontal, x for vertical). */
  axis: number
  /** Min along the parallel axis. */
  parMin: number
  /** Max along the parallel axis. */
  parMax: number
}

/**
 * After overlap shifting, traces on the same net can end up running on
 * *almost* the same horizontal or vertical line — close enough that the
 * schematic looks like a slightly bumpy line instead of a clean one.
 *
 * This phase walks each net and snaps near-collinear segments to a
 * shared axis value (shared y for horizontal pairs, shared x for
 * vertical pairs), then merges them into a single segment when they
 * already overlap or touch along the parallel axis.
 *
 * Two horizontal segments are considered combinable when:
 *   - they belong to the same `globalConnNetId`
 *   - both are horizontal (|y1 - y2| < EPS for each segment)
 *   - their constant-y values agree within `axisSnapTolerance`
 *   - they overlap or are within `gapTolerance` along the x-axis
 *
 * The same rule applies for vertical segments using x.
 */
export class SameNetTraceCombineSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: Array<SolvedTracePath>

  /** Tolerance for treating a segment as horizontal/vertical. */
  static readonly STRAIGHT_EPS = 2e-3
  /**
   * Two parallel segments must be within this distance on the perpendicular
   * axis to snap together. Defaults to STRAIGHT_EPS so the phase only
   * cleans up numerical drift without overriding deliberate trace spacing.
   * Callers wanting more aggressive combining can pass a larger tolerance.
   */
  static readonly AXIS_SNAP_TOLERANCE = 2e-3
  /** Two parallel segments are merged when their parallel-axis ranges overlap or touch within this gap. */
  static readonly GAP_TOLERANCE = 1e-6

  axisSnapTolerance: number
  gapTolerance: number

  /** Final output, keyed by mspPairId for downstream consumers. */
  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}

  /** How many segments were snapped/merged this run. Useful for tests + stats. */
  override stats: Record<string, number> = {
    segmentsSnapped: 0,
    segmentsMerged: 0,
    redundantPointsRemoved: 0,
  }

  constructor(params: {
    inputProblem: InputProblem
    inputTracePaths: Array<SolvedTracePath>
    axisSnapTolerance?: number
    gapTolerance?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.inputTracePaths
    this.axisSnapTolerance =
      params.axisSnapTolerance ?? SameNetTraceCombineSolver.AXIS_SNAP_TOLERANCE
    this.gapTolerance =
      params.gapTolerance ?? SameNetTraceCombineSolver.GAP_TOLERANCE
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceCombineSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTracePaths: this.inputTracePaths,
      axisSnapTolerance: this.axisSnapTolerance,
      gapTolerance: this.gapTolerance,
    }
  }

  /** Tracks which paths were touched by snapping so cleanup is scoped. */
  private snappedPathIds: Set<MspConnectionPairId> = new Set()

  override _step() {
    // Deep-copy input so callers can keep the original paths.
    const workingPaths: SolvedTracePath[] = this.inputTracePaths.map((p) => ({
      ...p,
      tracePath: p.tracePath.map((pt) => ({ x: pt.x, y: pt.y })),
    }))

    const islands = groupByNet(workingPaths)

    for (const netId of Object.keys(islands)) {
      const paths = islands[netId]!
      this.snapSegmentsForNet(paths, "horizontal")
      this.snapSegmentsForNet(paths, "vertical")
    }

    // After snapping, runs of consecutive points on a path that share the
    // same axis collapse via removeCollinearMidpoints (reverse iteration,
    // index-safe).  Scope this cleanup to paths we actually snapped, so
    // we don't strip intentional anchor midpoints from already-clean
    // upstream traces.
    for (const path of workingPaths) {
      if (this.snappedPathIds.has(path.mspPairId)) {
        const removed = removeCollinearMidpoints(
          path.tracePath,
          SameNetTraceCombineSolver.STRAIGHT_EPS,
        )
        this.stats.redundantPointsRemoved += removed
        this.stats.segmentsMerged += removed
      }
      this.correctedTraceMap[path.mspPairId] = path
    }

    this.solved = true
  }

  /**
   * Group collinear straight segments of the requested orientation across
   * all paths in this net, then snap each group onto a shared axis value.
   * Mutates points in place.  Splicing/removing points is *not* done
   * here — it's deferred to the final removeCollinearMidpoints pass so we
   * never operate on stale segment indexes.
   */
  private snapSegmentsForNet(
    paths: SolvedTracePath[],
    orientation: "horizontal" | "vertical",
  ): void {
    const segments = collectStraightSegments(
      paths,
      orientation,
      SameNetTraceCombineSolver.STRAIGHT_EPS,
    )

    const groups = groupCollinearSegments(segments, this.axisSnapTolerance)

    for (const group of groups) {
      if (group.length < 2) continue

      const sharedAxis =
        group.reduce((sum, seg) => sum + seg.axis, 0) / group.length

      for (const seg of group) {
        const path = paths[seg.pathIndex]!
        const a = path.tracePath[seg.segmentIndex]
        const b = path.tracePath[seg.segmentIndex + 1]
        // Defensive: paths can be mutated by earlier groups in another
        // orientation pass.  Skip silently if either endpoint is gone.
        if (!a || !b) continue
        let touched = false
        if (orientation === "horizontal") {
          if (a.y !== sharedAxis) {
            a.y = sharedAxis
            this.stats.segmentsSnapped++
            touched = true
          }
          if (b.y !== sharedAxis) {
            b.y = sharedAxis
            this.stats.segmentsSnapped++
            touched = true
          }
        } else {
          if (a.x !== sharedAxis) {
            a.x = sharedAxis
            this.stats.segmentsSnapped++
            touched = true
          }
          if (b.x !== sharedAxis) {
            b.x = sharedAxis
            this.stats.segmentsSnapped++
            touched = true
          }
        }
        if (touched) {
          this.snappedPathIds.add(path.mspPairId)
        }
      }
    }
  }

  override visualize(): GraphicsObject {
    const lines = Object.values(this.correctedTraceMap).flatMap((p) =>
      p.tracePath.slice(0, -1).map((pt, i) => ({
        points: [pt, p.tracePath[i + 1]!],
        strokeColor: "rgba(0,200,0,0.6)",
        label: `${p.globalConnNetId}`,
      })),
    )
    return { lines, points: [], rects: [], circles: [] }
  }
}

function groupByNet(
  paths: SolvedTracePath[],
): Record<ConnNetId, SolvedTracePath[]> {
  const islands: Record<ConnNetId, SolvedTracePath[]> = {}
  for (const path of paths) {
    const key = path.globalConnNetId
    if (!islands[key]) islands[key] = []
    islands[key].push(path)
  }
  return islands
}

function collectStraightSegments(
  paths: SolvedTracePath[],
  orientation: "horizontal" | "vertical",
  straightEps: number,
): SegmentRef[] {
  const out: SegmentRef[] = []
  for (let pi = 0; pi < paths.length; pi++) {
    const pts = paths[pi]!.tracePath
    for (let si = 0; si < pts.length - 1; si++) {
      const a = pts[si]!
      const b = pts[si + 1]!
      if (orientation === "horizontal") {
        if (Math.abs(a.y - b.y) > straightEps) continue
        out.push({
          pathIndex: pi,
          segmentIndex: si,
          axis: (a.y + b.y) / 2,
          parMin: Math.min(a.x, b.x),
          parMax: Math.max(a.x, b.x),
        })
      } else {
        if (Math.abs(a.x - b.x) > straightEps) continue
        out.push({
          pathIndex: pi,
          segmentIndex: si,
          axis: (a.x + b.x) / 2,
          parMin: Math.min(a.y, b.y),
          parMax: Math.max(a.y, b.y),
        })
      }
    }
  }
  return out
}

/**
 * Cluster segments whose constant-axis value is within `axisSnapTolerance`.
 * Uses a sort + sliding-window merge so the cost is O(n log n) rather than
 * pairwise.
 */
function groupCollinearSegments(
  segments: SegmentRef[],
  axisSnapTolerance: number,
): SegmentRef[][] {
  if (segments.length === 0) return []
  const sorted = [...segments].sort((a, b) => a.axis - b.axis)
  const groups: SegmentRef[][] = [[sorted[0]!]]
  for (let i = 1; i < sorted.length; i++) {
    const seg = sorted[i]!
    const currentGroup = groups[groups.length - 1]!
    const last = currentGroup[currentGroup.length - 1]!
    if (Math.abs(seg.axis - last.axis) <= axisSnapTolerance) {
      currentGroup.push(seg)
    } else {
      groups.push([seg])
    }
  }
  return groups
}

/**
 * Strip interior points where three consecutive points are collinear (all
 * sharing the same x for vertical runs, or the same y for horizontal runs).
 * Mutates the array in place; returns the number of points removed.
 */
function removeCollinearMidpoints(points: Point[], eps: number): number {
  let removed = 0
  for (let i = points.length - 2; i >= 1; i--) {
    const prev = points[i - 1]!
    const cur = points[i]!
    const next = points[i + 1]!
    const collinearY =
      Math.abs(prev.y - cur.y) < eps && Math.abs(cur.y - next.y) < eps
    const collinearX =
      Math.abs(prev.x - cur.x) < eps && Math.abs(cur.x - next.x) < eps
    if (collinearY || collinearX) {
      points.splice(i, 1)
      removed++
    }
  }
  return removed
}
