import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

/**
* TraceCombineSolver detects parallel orthogonal trace segments that belong to the same net and are separated by only a small configurable distance.
* It simplifies the schematic layout by merging these nearby parallel traces into a single, cleaner routing path.
 */
export class TraceCombineSolver {
  /**
   * Enhances a list of traces by merging close parallel segments.
   *
   * @param traces - The list of solved trace paths to process.
   * @param threshold - The maximum distance between parallel segments to consider them "close" (default: 0.05).
   * @returns The updated list of trace paths.
   */
  static tryCombineParallelTraces(traces: SolvedTracePath[], threshold = 0.05): SolvedTracePath[] {
    // Group traces by globalConnNetId
    const groupedByNet: Record<string, SolvedTracePath[]> = {}
    for (const trace of traces) {
      const netId = trace.globalConnNetId || "default"
      if (!groupedByNet[netId]) {
        groupedByNet[netId] = []
      }
      groupedByNet[netId].push(trace)
    }

    // Process each net group
    for (const netId of Object.keys(groupedByNet)) {
      const netTraces = groupedByNet[netId]!

      // PASS 1: Horizontal segments (close in Y, overlapping in X)
      this.combineDirection(netTraces, "horizontal", threshold)

      // PASS 2: Vertical segments (close in X, overlapping in Y)
      this.combineDirection(netTraces, "vertical", threshold)

      // Simplify paths after shifting to clean up any redundant or collinear points
      for (const trace of netTraces) {
        trace.tracePath = simplifyPath(trace.tracePath)
      }
    }

    return traces
  }

  private static combineDirection(
    netTraces: SolvedTracePath[],
    direction: "horizontal" | "vertical",
    threshold: number
  ) {
    const segments: Array<{
      trace: SolvedTracePath
      p1: Point
      p2: Point
      coord: number // y for horizontal, x for vertical
      minSpan: number // min x for horizontal, min y for vertical
      maxSpan: number // max x for horizontal, max y for vertical
    }> = []

    for (const trace of netTraces) {
      const path = trace.tracePath
      for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i]
        const p2 = path[i + 1]

        const isH = Math.abs(p1.y - p2.y) < 1e-4
        const isV = Math.abs(p1.x - p2.x) < 1e-4

        if (direction === "horizontal" && isH) {
          segments.push({
            trace,
            p1,
            p2,
            coord: (p1.y + p2.y) / 2,
            minSpan: Math.min(p1.x, p2.x),
            maxSpan: Math.max(p1.x, p2.x),
          })
        } else if (direction === "vertical" && isV) {
          segments.push({
            trace,
            p1,
            p2,
            coord: (p1.x + p2.x) / 2,
            minSpan: Math.min(p1.y, p2.y),
            maxSpan: Math.max(p1.y, p2.y),
          })
        }
      }
    }

    if (segments.length < 2) return

    // Cluster segments that are close and overlap
    // Using a Disjoint Set Union (DSU) to find groups
    const parent = Array.from({ length: segments.length }, (_, i) => i)
    const find = (i: number): number => {
      if (parent[i] === i) return i
      return (parent[i] = find(parent[i]))
    }
    const union = (i: number, j: number) => {
      const rootI = find(i)
      const rootJ = find(j)
      if (rootI !== rootJ) {
        parent[rootI] = rootJ
      }
    }

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const segA = segments[i]
        const segB = segments[j]

        // Check if they are close parallel lines
        if (Math.abs(segA.coord - segB.coord) <= threshold) {
          // Check if spans overlap in the other dimension
          const overlap = Math.min(segA.maxSpan, segB.maxSpan) - Math.max(segA.minSpan, segB.minSpan)
          if (overlap > 1e-4) {
            union(i, j)
          }
        }
      }
    }

    // Group segments by root parent
    const clusters: Record<number, number[]> = {}
    for (let i = 0; i < segments.length; i++) {
      const root = find(i)
      if (!clusters[root]) clusters[root] = []
      clusters[root].push(i)
    }

    // Apply average coordinate to each cluster
    for (const root of Object.keys(clusters)) {
      const indices = clusters[Number(root)]!
      if (indices.length < 2) continue

      // Calculate average coordinate of the cluster
      let sum = 0
      for (const idx of indices) {
        sum += segments[idx].coord
      }
      const centerAxis = sum / indices.length

      // Set the coordinate for all points in the segments of the cluster
      for (const idx of indices) {
        const seg = segments[idx]
        if (direction === "horizontal") {
          seg.p1.y = centerAxis
          seg.p2.y = centerAxis
        } else {
          seg.p1.x = centerAxis
          seg.p2.x = centerAxis
        }
      }
    }
  }
}
