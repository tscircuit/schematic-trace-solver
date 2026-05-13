import type { Point } from "@tscircuit/math-utils"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

interface TraceSegment {
  traceId: string
  netId: string
  startPoint: Point
  endPoint: Point
  isHorizontal: boolean
  /** The segment's fixed coordinate: Y for horizontal, X for vertical */
  fixedCoord: number
}

interface AlignCluster {
  orientation: "h" | "v"
  alignTo: number
  segmentIds: string[]
}

/**
 * SameNetTraceAlignSolver
 *
 * Issue #34: "Merge same-net trace lines that are close together
 * (make at the same Y or same X)"
 *
 * Reduces visual clutter by snapping same-net trace segments that are
 * close together to share the same Y coordinate (for horizontal) or
 * X coordinate (for vertical).
 *
 * Algorithm:
 * 1. Groups traces by globalConnNetId
 * 2. Extracts all trace segments from each net
 * 3. Uses single-linkage clustering on the fixed coordinate
 *   (Y for horizontal segments, X for vertical segments)
 *   to find groups that should share a coordinate
 * 4. Computes average coordinate per cluster and snaps all
 *   segments to that average
 */
export class SameNetTraceAlignSolver extends BaseSolver {
  private traces: SolvedTracePath[]
  private proximityThreshold: number
  private _stepCount = 0
  private netsToProcess: string[] = []
  private tracesByNet: Map<string, SolvedTracePath[]>
  private outputTraces: SolvedTracePath[]
  private pendingAlignments: Map<
    string,
    { orientation: "h" | "v"; alignTo: number }[]
  >

  constructor(traces: SolvedTracePath[], proximityThreshold = 0.19) {
    super()
    this.traces = traces
    this.proximityThreshold = proximityThreshold
    this.tracesByNet = this._groupTracesByNet(traces)
    this.netsToProcess = Array.from(this.tracesByNet.keys())
    this.outputTraces = traces.map((t) => ({
      ...t,
      tracePath: t.tracePath.map((p) => ({ ...p })),
    }))
    this.pendingAlignments = new Map()
  }

  override _step() {
    this._stepCount++

    if (this.netsToProcess.length === 0) {
      this.solved = true
      return
    }

    const netId = this.netsToProcess[0]
    const traces = this.tracesByNet.get(netId) || []
    this._computeAndApplyAlignments(netId, traces)
    this.netsToProcess.shift()
  }

  private _groupTracesByNet(
    traces: SolvedTracePath[],
  ): Map<string, SolvedTracePath[]> {
    const groups = new Map<string, SolvedTracePath[]>()
    for (const trace of traces) {
      const netId = trace.globalConnNetId
      if (!groups.has(netId)) groups.set(netId, [])
      groups.get(netId)!.push(trace)
    }
    return groups
  }

  private _extractSegments(traces: SolvedTracePath[]): TraceSegment[] {
    const segments: TraceSegment[] = []
    for (const trace of traces) {
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        const start = trace.tracePath[i]
        const end = trace.tracePath[i + 1]
        const isHorizontal = Math.abs(end.y - start.y) < 0.001
        segments.push({
          traceId: trace.mspPairId,
          netId: trace.globalConnNetId,
          startPoint: start,
          endPoint: end,
          isHorizontal,
          fixedCoord: isHorizontal ? end.y : end.x,
        })
      }
    }
    return segments
  }

  private _clusterSegments(
    segments: TraceSegment[],
    getCoord: (s: TraceSegment) => number,
  ): string[][] {
    if (segments.length === 0) return []
    // Stable IDs: unique per call using original array index
    const ids = segments.map((_s, i) => String(i))
    const parent = ids.map((_, i) => i)
    const coords = segments.map(getCoord)

    const find = (i: number): number => {
      if (parent[i] !== i) parent[i] = find(parent[i])
      return parent[i]
    }

    const union = (i: number, j: number) => {
      const ri = find(i)
      const rj = find(j)
      if (ri !== rj) parent[ri] = rj
    }

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        if (Math.abs(coords[i] - coords[j]) <= this.proximityThreshold) {
          union(i, j)
        }
      }
    }

    const clusterMap = new Map<number, string[]>()
    for (let i = 0; i < segments.length; i++) {
      const root = find(i)
      if (!clusterMap.has(root)) clusterMap.set(root, [])
      clusterMap.get(root)!.push(ids[i])
    }

    const result = Array.from(clusterMap.values())
    return result
  }

  private _computeAndApplyAlignments(netId: string, traces: SolvedTracePath[]) {
    const segments = this._extractSegments(traces)
    if (segments.length === 0) return

    const hSegments = segments.filter((s) => s.isHorizontal)
    const vSegments = segments.filter((s) => !s.isHorizontal)

    // Build cluster map: segmentId → cluster
    const segmentClusterMap = new Map<
      string,
      { orient: "h" | "v"; alignTo: number }
    >()

    const hClusters = this._clusterSegments(hSegments, (s) => s.fixedCoord)
    for (const cluster of hClusters) {
      if (cluster.length < 2) continue
      const segs = cluster.map((id) => hSegments[parseInt(id)])
      const avgY = segs.reduce((sum, s) => sum + s.fixedCoord, 0) / segs.length
      for (const id of cluster) {
        segmentClusterMap.set(id, { orient: "h", alignTo: avgY })
      }
    }

    const vClusters = this._clusterSegments(vSegments, (s) => s.fixedCoord)
    for (const cluster of vClusters) {
      if (cluster.length < 2) continue
      const segs = cluster.map((id) => vSegments[parseInt(id)])
      const avgX = segs.reduce((sum, s) => sum + s.fixedCoord, 0) / segs.length
      for (const id of cluster) {
        segmentClusterMap.set(id, { orient: "v", alignTo: avgX })
      }
    }

    if (segmentClusterMap.size === 0) return

    // Apply to output traces
    const allSegs = this._extractSegments(traces)
    for (const seg of allSegs) {
      const segIdx = allSegs.indexOf(seg)
      const segId = String(segIdx)
      const align = segmentClusterMap.get(segId)
      if (!align) continue

      const outTrace = this.outputTraces.find(
        (t) => t.mspPairId === seg.traceId,
      )
      if (!outTrace) continue

      for (const pt of outTrace.tracePath) {
        const atStart =
          Math.abs(pt.x - seg.startPoint.x) < 0.001 &&
          Math.abs(pt.y - seg.startPoint.y) < 0.001
        const atEnd =
          Math.abs(pt.x - seg.endPoint.x) < 0.001 &&
          Math.abs(pt.y - seg.endPoint.y) < 0.001
        if (!atStart && !atEnd) continue

        if (align.orient === "h") {
          pt.y = align.alignTo
        } else {
          pt.x = align.alignTo
        }
      }
    }
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: this.outputTraces }
  }
}
