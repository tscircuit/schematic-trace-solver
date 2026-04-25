import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { GraphicsObject } from "graphics-debug"

type ConnNetId = string

const EPS = 2e-3

interface SegmentRef {
  mspPairId: MspConnectionPairId
  segmentIndex: number
  /** For horizontal segments: Y value. For vertical segments: X value. */
  coordinate: number
  /** Start of the range along the other axis */
  rangeStart: number
  /** End of the range along the other axis */
  rangeEnd: number
}

/**
 * This solver finds same-net trace segments that run parallel and close
 * together, then snaps them to the same coordinate (Y for horizontal
 * segments, X for vertical segments).
 *
 * This reduces visual clutter by consolidating nearly-parallel same-net
 * traces into shared lines.
 *
 * Only merges segments from DIFFERENT traces (different mspPairIds) within
 * the same net, and only when segments have genuine range overlap along
 * their shared axis.
 */
export class SameNetTraceLineMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: Array<SolvedTracePath>
  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}
  mergeThreshold: number

  constructor(params: {
    inputProblem: InputProblem
    inputTracePaths: Array<SolvedTracePath>
    mergeThreshold?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.inputTracePaths
    this.mergeThreshold = params.mergeThreshold ?? 0.06

    for (const tracePath of this.inputTracePaths) {
      this.correctedTraceMap[tracePath.mspPairId] = {
        ...tracePath,
        tracePath: tracePath.tracePath.map((p) => ({ ...p })),
      }
    }
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceLineMergeSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTracePaths: this.inputTracePaths,
      mergeThreshold: this.mergeThreshold,
    }
  }

  override _step() {
    const netGroups = this.groupTracesByNet()

    for (const traces of Object.values(netGroups)) {
      if (traces.length < 2) continue
      this.mergeCloseSegmentsInNet(traces)
    }

    this.solved = true
  }

  private groupTracesByNet(): Record<ConnNetId, SolvedTracePath[]> {
    const groups: Record<string, SolvedTracePath[]> = {}
    for (const trace of Object.values(this.correctedTraceMap)) {
      const netId = trace.globalConnNetId
      if (!groups[netId]) groups[netId] = []
      groups[netId].push(trace)
    }
    return groups
  }

  private collectSegments(traces: SolvedTracePath[]): {
    horizontal: SegmentRef[]
    vertical: SegmentRef[]
  } {
    const horizontal: SegmentRef[] = []
    const vertical: SegmentRef[] = []

    for (const trace of traces) {
      const points = trace.tracePath
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i]!
        const p2 = points[i + 1]!

        const isHorizontal = Math.abs(p1.y - p2.y) < EPS
        const isVertical = Math.abs(p1.x - p2.x) < EPS

        if (isHorizontal) {
          horizontal.push({
            mspPairId: trace.mspPairId,
            segmentIndex: i,
            coordinate: (p1.y + p2.y) / 2,
            rangeStart: Math.min(p1.x, p2.x),
            rangeEnd: Math.max(p1.x, p2.x),
          })
        } else if (isVertical) {
          vertical.push({
            mspPairId: trace.mspPairId,
            segmentIndex: i,
            coordinate: (p1.x + p2.x) / 2,
            rangeStart: Math.min(p1.y, p2.y),
            rangeEnd: Math.max(p1.y, p2.y),
          })
        }
      }
    }

    return { horizontal, vertical }
  }

  /**
   * Find merge-worthy pairs using strict pairwise comparison.
   * Uses union-find to group segments that are transitively close.
   */
  private findMergeClusters(segments: SegmentRef[]): SegmentRef[][] {
    if (segments.length < 2) return []

    // Union-find
    const parent: number[] = segments.map((_, i) => i)
    const find = (i: number): number => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]!]!
        i = parent[i]!
      }
      return i
    }
    const union = (a: number, b: number) => {
      parent[find(a)] = find(b)
    }

    // Pairwise comparison — only merge segments from different traces
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i]!
        const b = segments[j]!

        // Must be from different traces
        if (a.mspPairId === b.mspPairId) continue

        // Must be close in the perpendicular axis
        if (Math.abs(a.coordinate - b.coordinate) >= this.mergeThreshold)
          continue

        // Must have genuine range overlap along the shared axis
        const overlapLen =
          Math.min(a.rangeEnd, b.rangeEnd) -
          Math.max(a.rangeStart, b.rangeStart)
        if (overlapLen <= EPS) continue

        union(i, j)
      }
    }

    // Collect clusters
    const clusterMap: Record<number, SegmentRef[]> = {}
    for (let i = 0; i < segments.length; i++) {
      const root = find(i)
      if (!clusterMap[root]) clusterMap[root] = []
      clusterMap[root].push(segments[i]!)
    }

    // Only return clusters with segments from multiple traces
    return Object.values(clusterMap).filter((cluster) => {
      if (cluster.length < 2) return false
      const firstId = cluster[0]!.mspPairId
      return cluster.some((s) => s.mspPairId !== firstId)
    })
  }

  private applyMerge(
    clusters: SegmentRef[][],
    orientation: "horizontal" | "vertical",
  ) {
    for (const cluster of clusters) {
      // Use weighted average by segment length for more stable merging
      let totalLength = 0
      let weightedSum = 0
      for (const seg of cluster) {
        const length = seg.rangeEnd - seg.rangeStart
        weightedSum += seg.coordinate * length
        totalLength += length
      }
      const targetCoord =
        totalLength > 0 ? weightedSum / totalLength : cluster[0]!.coordinate

      for (const seg of cluster) {
        const trace = this.correctedTraceMap[seg.mspPairId]
        if (!trace) continue

        const p1 = trace.tracePath[seg.segmentIndex]!
        const p2 = trace.tracePath[seg.segmentIndex + 1]!

        if (orientation === "horizontal") {
          p1.y = targetCoord
          p2.y = targetCoord
        } else {
          p1.x = targetCoord
          p2.x = targetCoord
        }
      }
    }
  }

  private mergeCloseSegmentsInNet(traces: SolvedTracePath[]) {
    const { horizontal, vertical } = this.collectSegments(traces)

    const hClusters = this.findMergeClusters(horizontal)
    this.applyMerge(hClusters, "horizontal")

    const vClusters = this.findMergeClusters(vertical)
    this.applyMerge(vClusters, "vertical")
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)

    for (const trace of Object.values(this.correctedTraceMap)) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "blue",
      })
    }

    // Also show original traces in faded color for comparison
    for (const trace of this.inputTracePaths) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "rgba(200, 200, 200, 0.4)",
      })
    }

    return graphics
  }
}
