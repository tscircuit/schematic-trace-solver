import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { Point } from "@tscircuit/math-utils"

/**
 * Threshold for considering two segments at "the same" Y or X.
 */
const DEFAULT_ALIGNMENT_THRESHOLD = 0.3

/**
 * Aligns same-net trace segments that are close together to the same Y
 * (horizontal segments) or same X (vertical segments), making them appear
 * merged while keeping trace objects intact.
 *
 * Algorithm:
 * 1. Group traces by net
 * 2. For each net, find all horizontal segments and cluster by Y proximity
 * 3. For each cluster, align all segments to the average Y
 * 4. Repeat for vertical segments and X proximity
 */
export class TraceMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  alignmentThreshold: number

  private netIds: string[]
  private currentNetIdx: number = 0

  constructor({
    inputProblem,
    traces,
    alignmentThreshold = DEFAULT_ALIGNMENT_THRESHOLD,
  }: {
    inputProblem: InputProblem
    traces: SolvedTracePath[]
    alignmentThreshold?: number
  }) {
    super()
    this.inputProblem = inputProblem
    this.traces = traces
    this.outputTraces = structuredClone(traces)
    this.alignmentThreshold = alignmentThreshold

    // Collect unique nets
    const netSet = new Set<string>()
    for (const trace of traces) {
      netSet.add(trace.globalConnNetId)
    }
    this.netIds = Array.from(netSet)
  }

  override getConstructorParams() {
    return {
      inputProblem: this.inputProblem,
      traces: this.traces,
      alignmentThreshold: this.alignmentThreshold,
    }
  }

  override _step() {
    if (this.currentNetIdx >= this.netIds.length) {
      this.solved = true
      return
    }

    const netId = this.netIds[this.currentNetIdx]!
    // Get traces for this net from outputTraces
    const netTraces = this.outputTraces.filter(
      (t) => t.globalConnNetId === netId
    )

    if (netTraces.length >= 2) {
      // Align horizontal segments
      this.alignHorizontalSegments(netTraces)
      // Align vertical segments
      this.alignVerticalSegments(netTraces)
    }

    this.currentNetIdx++
  }

  /**
   * Collects all horizontal segments from traces, clusters them by Y proximity,
   * and aligns each cluster to the average Y.
   */
  private alignHorizontalSegments(traces: SolvedTracePath[]) {
    type HSegment = { traceIdx: number; pointIdx: number; y: number }
    const segments: HSegment[] = []

    for (let t = 0; t < traces.length; t++) {
      const path = traces[t]!.tracePath
      for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i]!
        const p2 = path[i + 1]!
        if (Math.abs(p1.y - p2.y) < 0.001) {
          segments.push({
            traceIdx: t,
            pointIdx: i,
            y: p1.y,
          })
        }
      }
    }

    if (segments.length < 2) return

    // Cluster by Y proximity
    const sorted = [...segments].sort((a, b) => a.y - b.y)
    const clusters: HSegment[][] = []
    let currentCluster: HSegment[] = [sorted[0]!]

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.y - sorted[i - 1]!.y <= this.alignmentThreshold) {
        currentCluster.push(sorted[i]!)
      } else {
        clusters.push(currentCluster)
        currentCluster = [sorted[i]!]
      }
    }
    clusters.push(currentCluster)

    // Align each cluster to average Y
    for (const cluster of clusters) {
      if (cluster.length < 2) continue

      const avgY = cluster.reduce((sum, s) => sum + s.y, 0) / cluster.length

      for (const seg of cluster) {
        const path = traces[seg.traceIdx]!.tracePath
        path[seg.pointIdx] = { ...path[seg.pointIdx]!, y: avgY }
        path[seg.pointIdx + 1] = { ...path[seg.pointIdx + 1]!, y: avgY }
      }
    }
  }

  /**
   * Collects all vertical segments from traces, clusters them by X proximity,
   * and aligns each cluster to the average X.
   */
  private alignVerticalSegments(traces: SolvedTracePath[]) {
    type VSegment = { traceIdx: number; pointIdx: number; x: number }
    const segments: VSegment[] = []

    for (let t = 0; t < traces.length; t++) {
      const path = traces[t]!.tracePath
      for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i]!
        const p2 = path[i + 1]!
        if (Math.abs(p1.x - p2.x) < 0.001) {
          segments.push({
            traceIdx: t,
            pointIdx: i,
            x: p1.x,
          })
        }
      }
    }

    if (segments.length < 2) return

    // Cluster by X proximity
    const sorted = [...segments].sort((a, b) => a.x - b.x)
    const clusters: VSegment[][] = []
    let currentCluster: VSegment[] = [sorted[0]!]

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.x - sorted[i - 1]!.x <= this.alignmentThreshold) {
        currentCluster.push(sorted[i]!)
      } else {
        clusters.push(currentCluster)
        currentCluster = [sorted[i]!]
      }
    }
    clusters.push(currentCluster)

    // Align each cluster to average X
    for (const cluster of clusters) {
      if (cluster.length < 2) continue

      const avgX = cluster.reduce((sum, s) => sum + s.x, 0) / cluster.length

      for (const seg of cluster) {
        const path = traces[seg.traceIdx]!.tracePath
        path[seg.pointIdx] = { ...path[seg.pointIdx]!, x: avgX }
        path[seg.pointIdx + 1] = { ...path[seg.pointIdx + 1]!, x: avgX }
      }
    }
  }

  getOutput() {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    return {
      lines: this.outputTraces.flatMap((t) =>
        t.tracePath.slice(0, -1).map((p, i) => ({
          x1: p.x,
          y1: p.y,
          x2: t.tracePath[i + 1]!.x,
          y2: t.tracePath[i + 1]!.y,
          label: t.globalConnNetId,
          stroke: t.globalConnNetId === "GND" ? "green" : "blue",
        }))
      ),
      points: [],
      rects: [],
      circles: [],
      texts: [],
    }
  }
}
