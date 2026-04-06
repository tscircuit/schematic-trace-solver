import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { Point } from "@tscircuit/math-utils"

/**
 * Tolerance for considering two segments as collinear (on the same axis line).
 * Segments whose perpendicular-axis coordinates differ by at most this value
 * are treated as collinear.
 */
const COLLINEAR_TOLERANCE = 0.05

/**
 * Maximum gap between two collinear segments for them to be merged.
 * If the gap is larger than this, segments are left untouched.
 */
const GAP_TOLERANCE = 0.15

type Segment = {
  /** Index of the trace in the traces array */
  traceIndex: number
  /** Starting point index in the trace path */
  startIdx: number
  /** Ending point index in the trace path */
  endIdx: number
  /** Whether the segment is horizontal or vertical */
  orientation: "horizontal" | "vertical"
  /** For horizontal segments: y coordinate; for vertical segments: x coordinate */
  axisCoord: number
  /** Start of the segment along its primary axis */
  rangeStart: number
  /** End of the segment along its primary axis */
  rangeEnd: number
}

interface SameNetTraceCombiningSolverInput {
  inputProblem: InputProblem
  allTraces: SolvedTracePath[]
}

/**
 * SameNetTraceCombiningSolver merges collinear trace segments belonging to the
 * same net when they are close together (gap <= GAP_TOLERANCE) or overlapping.
 *
 * This reduces visual clutter in schematics by combining redundant parallel
 * traces into single longer lines.
 *
 * It runs as a pipeline phase after TraceCleanupSolver and before the final
 * NetLabelPlacementSolver.
 */
export class SameNetTraceCombiningSolver extends BaseSolver {
  private input: SameNetTraceCombiningSolverInput
  private outputTraces: SolvedTracePath[]

  constructor(input: SameNetTraceCombiningSolverInput) {
    super()
    this.input = input
    this.outputTraces = input.allTraces.map((t) => ({
      ...t,
      tracePath: [...t.tracePath.map((p) => ({ ...p }))],
    }))
  }

  override _step() {
    // Group traces by globalConnNetId
    const tracesByNet = new Map<string, number[]>()
    for (let i = 0; i < this.outputTraces.length; i++) {
      const trace = this.outputTraces[i]
      const netId = trace.globalConnNetId
      if (!netId) continue
      if (!tracesByNet.has(netId)) {
        tracesByNet.set(netId, [])
      }
      tracesByNet.get(netId)!.push(i)
    }

    // For each net group with multiple traces, try to merge collinear segments
    for (const [_netId, traceIndices] of tracesByNet) {
      if (traceIndices.length < 2) continue

      // Extract all axis-aligned segments from traces in this net
      const allSegments: Segment[] = []
      for (const traceIdx of traceIndices) {
        const trace = this.outputTraces[traceIdx]
        const segments = this.extractSegments(traceIdx, trace.tracePath)
        allSegments.push(...segments)
      }

      // Find and perform merges between segments from DIFFERENT traces
      this.mergeCollinearSegments(allSegments)
    }

    this.solved = true
  }

  /**
   * Extract axis-aligned segments from a trace path.
   */
  private extractSegments(traceIndex: number, path: Point[]): Segment[] {
    const segments: Segment[] = []
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i]
      const p2 = path[i + 1]

      const dx = Math.abs(p2.x - p1.x)
      const dy = Math.abs(p2.y - p1.y)

      // Skip zero-length segments
      if (dx < 1e-9 && dy < 1e-9) continue

      if (dx >= dy) {
        // Horizontal segment
        segments.push({
          traceIndex,
          startIdx: i,
          endIdx: i + 1,
          orientation: "horizontal",
          axisCoord: (p1.y + p2.y) / 2,
          rangeStart: Math.min(p1.x, p2.x),
          rangeEnd: Math.max(p1.x, p2.x),
        })
      } else {
        // Vertical segment
        segments.push({
          traceIndex,
          startIdx: i,
          endIdx: i + 1,
          orientation: "vertical",
          axisCoord: (p1.x + p2.x) / 2,
          rangeStart: Math.min(p1.y, p2.y),
          rangeEnd: Math.max(p1.y, p2.y),
        })
      }
    }
    return segments
  }

  /**
   * Find pairs of collinear segments from different traces and merge them.
   */
  private mergeCollinearSegments(segments: Segment[]) {
    const merged = new Set<number>()

    for (let i = 0; i < segments.length; i++) {
      if (merged.has(i)) continue
      for (let j = i + 1; j < segments.length; j++) {
        if (merged.has(j)) continue

        const segA = segments[i]
        const segB = segments[j]

        // Must be from different traces
        if (segA.traceIndex === segB.traceIndex) continue

        // Must have same orientation
        if (segA.orientation !== segB.orientation) continue

        // Must be collinear (on the same axis line within tolerance)
        if (Math.abs(segA.axisCoord - segB.axisCoord) > COLLINEAR_TOLERANCE)
          continue

        // Check gap between segments along their primary axis
        const gap = Math.max(
          0,
          Math.max(segA.rangeStart, segB.rangeStart) -
            Math.min(segA.rangeEnd, segB.rangeEnd),
        )
        if (gap > GAP_TOLERANCE) continue

        // Merge: extend segA to cover both, collapse segB
        this.performMerge(segA, segB)
        merged.add(j)
      }
    }
  }

  /**
   * Perform the actual merge of two collinear segments.
   * Extends segA to cover the full span and collapses segB to a zero-length point.
   */
  private performMerge(segA: Segment, segB: Segment) {
    const traceA = this.outputTraces[segA.traceIndex]
    const traceB = this.outputTraces[segB.traceIndex]

    // Compute merged span
    const mergedRangeStart = Math.min(segA.rangeStart, segB.rangeStart)
    const mergedRangeEnd = Math.max(segA.rangeEnd, segB.rangeEnd)

    // Average the axis coordinate to handle micro-alignment differences
    const avgAxisCoord = (segA.axisCoord + segB.axisCoord) / 2

    if (segA.orientation === "horizontal") {
      // Update traceA segment to cover the full horizontal span
      const pathA = traceA.tracePath
      if (pathA[segA.startIdx].x <= pathA[segA.endIdx].x) {
        pathA[segA.startIdx] = { x: mergedRangeStart, y: avgAxisCoord }
        pathA[segA.endIdx] = { x: mergedRangeEnd, y: avgAxisCoord }
      } else {
        pathA[segA.startIdx] = { x: mergedRangeEnd, y: avgAxisCoord }
        pathA[segA.endIdx] = { x: mergedRangeStart, y: avgAxisCoord }
      }

      // Collapse traceB segment to a zero-length point at the midpoint
      const midX = (segB.rangeStart + segB.rangeEnd) / 2
      const pathB = traceB.tracePath
      pathB[segB.startIdx] = { x: midX, y: avgAxisCoord }
      pathB[segB.endIdx] = { x: midX, y: avgAxisCoord }
    } else {
      // Vertical segment
      const pathA = traceA.tracePath
      if (pathA[segA.startIdx].y <= pathA[segA.endIdx].y) {
        pathA[segA.startIdx] = { x: avgAxisCoord, y: mergedRangeStart }
        pathA[segA.endIdx] = { x: avgAxisCoord, y: mergedRangeEnd }
      } else {
        pathA[segA.startIdx] = { x: avgAxisCoord, y: mergedRangeEnd }
        pathA[segA.endIdx] = { x: avgAxisCoord, y: mergedRangeStart }
      }

      // Collapse traceB segment
      const midY = (segB.rangeStart + segB.rangeEnd) / 2
      const pathB = traceB.tracePath
      pathB[segB.startIdx] = { x: avgAxisCoord, y: midY }
      pathB[segB.endIdx] = { x: avgAxisCoord, y: midY }
    }
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.input.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    if (!graphics.lines) graphics.lines = []

    for (const trace of this.outputTraces) {
      const line: Line = {
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "blue",
      }
      graphics.lines.push(line)
    }
    return graphics
  }
}
