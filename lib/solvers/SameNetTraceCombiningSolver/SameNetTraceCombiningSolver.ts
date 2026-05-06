import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * Tolerance for considering two segments as collinear (on the same axis line).
 * Segments whose perpendicular-axis coordinates differ by at most this value
 * are treated as being on the same line.
 */
const COLLINEAR_TOLERANCE = 0.05

/**
 * Maximum gap between two collinear segments for them to be merged.
 * If the gap between the closest endpoints is larger than this, the
 * segments are left untouched.
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
  /**
   * The coordinate on the constant axis:
   *   - For horizontal segments: the y coordinate
   *   - For vertical segments: the x coordinate
   */
  axisCoord: number
  /** Lower bound along the varying axis */
  minCoord: number
  /** Upper bound along the varying axis */
  maxCoord: number
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
 * traces into single cleaner lines.  It operates specifically on axis-aligned
 * (horizontal or vertical) trace segments.
 *
 * Pipeline position: after TraceCleanupSolver, before NetLabelPlacementSolver.
 */
export class SameNetTraceCombiningSolver extends BaseSolver {
  private input: SameNetTraceCombiningSolverInput
  private outputTraces: SolvedTracePath[]

  constructor(input: SameNetTraceCombiningSolverInput) {
    super()
    this.input = input
    // Deep-copy trace paths so we never mutate the originals
    this.outputTraces = input.allTraces.map((t) => ({
      ...t,
      tracePath: [...t.tracePath.map((p) => ({ x: p.x, y: p.y }))],
    }))
  }

  override _step() {
    // Group traces by globalConnNetId
    const tracesByNet = new Map<string, number[]>()
    for (let i = 0; i < this.outputTraces.length; i++) {
      const netId = this.outputTraces[i].globalConnNetId
      if (!netId) continue
      if (!tracesByNet.has(netId)) {
        tracesByNet.set(netId, [])
      }
      tracesByNet.get(netId)!.push(i)
    }

    for (const [, traceIndices] of tracesByNet) {
      if (traceIndices.length < 2) continue

      // Collect every axis-aligned segment from every trace in this net
      const allSegments: Segment[] = []
      for (const traceIdx of traceIndices) {
        const trace = this.outputTraces[traceIdx]
        const segments = this.extractSegments(traceIdx, trace.tracePath)
        allSegments.push(...segments)
      }

      // Merge eligible segments iteratively
      this.mergeCollinearSegments(allSegments)
    }

    // Final pass: simplify every trace by removing zero-length segments
    // and consecutive duplicate points
    for (const trace of this.outputTraces) {
      trace.tracePath = simplifyTracePath(trace.tracePath)
    }

    this.solved = true
  }

  /**
   * Extract all axis-aligned segments from a single trace polyline.
   * A segment is a pair of consecutive points in the polyline.
   */
  private extractSegments(traceIndex: number, path: Point[]): Segment[] {
    const segments: Segment[] = []
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i]
      const p2 = path[i + 1]

      const dx = Math.abs(p2.x - p1.x)
      const dy = Math.abs(p2.y - p1.y)

      // Skip near-zero-length segments
      if (dx < 1e-9 && dy < 1e-9) continue

      if (dx >= dy) {
        // Horizontal segment — constant Y
        segments.push({
          traceIndex,
          startIdx: i,
          endIdx: i + 1,
          orientation: "horizontal",
          axisCoord: (p1.y + p2.y) / 2,
          minCoord: Math.min(p1.x, p2.x),
          maxCoord: Math.max(p1.x, p2.x),
        })
      } else {
        // Vertical segment — constant X
        segments.push({
          traceIndex,
          startIdx: i,
          endIdx: i + 1,
          orientation: "vertical",
          axisCoord: (p1.x + p2.x) / 2,
          minCoord: Math.min(p1.y, p2.y),
          maxCoord: Math.max(p1.y, p2.y),
        })
      }
    }
    return segments
  }

  /**
   * Scan all segments and merge every eligible collinear pair.
   *
   * Merging strategy:
   * - Extend segment A to cover the combined span of A+B
   * - Collapse segment B so its start equals its end (a zero-length point)
   * The post-processing `simplifyTracePath` step later removes those
   * collapsed points.
   */
  private mergeCollinearSegments(segments: Segment[]) {
    const merged = new Set<number>()

    for (let i = 0; i < segments.length; i++) {
      if (merged.has(i)) continue
      for (let j = i + 1; j < segments.length; j++) {
        if (merged.has(j)) continue

        const segA = segments[i]
        const segB = segments[j]

        // Only merge segments from different traces
        if (segA.traceIndex === segB.traceIndex) continue

        // Must have the same orientation
        if (segA.orientation !== segB.orientation) continue

        // Must be near-collinear (on approximately the same axis)
        if (Math.abs(segA.axisCoord - segB.axisCoord) > COLLINEAR_TOLERANCE)
          continue

        // Compute the gap between the two segments along the primary axis
        const gap = Math.max(
          0,
          Math.max(segA.minCoord, segB.minCoord) -
            Math.min(segA.maxCoord, segB.maxCoord),
        )
        if (gap > GAP_TOLERANCE) continue

        // Perform merge
        this.performMerge(segA, segB)
        merged.add(j)
      }
    }

    // Mark any collapsed segments on already-processed traces as merged
    // so they don't get extended again in a future iteration
    for (const idx of merged) {
      const seg = segments[idx]
      const trace = this.outputTraces[seg.traceIndex]
      // Mark the segment endpoints as equal (already done in performMerge for B)
    }
  }

  /**
   * Extend segment A to the full union of A and B, then collapse segment B
   * into a zero-length point at the midpoint of its original span.
   */
  private performMerge(segA: Segment, segB: Segment) {
    const traceA = this.outputTraces[segA.traceIndex]
    const traceB = this.outputTraces[segB.traceIndex]

    const mergedMin = Math.min(segA.minCoord, segB.minCoord)
    const mergedMax = Math.max(segA.maxCoord, segB.maxCoord)

    // Snap both segments to a shared axis coordinate
    const avgAxis = (segA.axisCoord + segB.axisCoord) / 2

    if (segA.orientation === "horizontal") {
      // Extend segment A to cover the entire horizontal span
      const pathA = traceA.tracePath
      pathA[segA.startIdx] = { x: mergedMin, y: avgAxis }
      pathA[segA.endIdx] = { x: mergedMax, y: avgAxis }

      // Collapse segment B into a single point at its midpoint
      const mid = (segB.minCoord + segB.maxCoord) / 2
      const pathB = traceB.tracePath
      pathB[segB.startIdx] = { x: mid, y: avgAxis }
      pathB[segB.endIdx] = { x: mid, y: avgAxis }
    } else {
      // Extend segment A to cover the entire vertical span
      const pathA = traceA.tracePath
      pathA[segA.startIdx] = { x: avgAxis, y: mergedMin }
      pathA[segA.endIdx] = { x: avgAxis, y: mergedMax }

      // Collapse segment B
      const mid = (segB.minCoord + segB.maxCoord) / 2
      const pathB = traceB.tracePath
      pathB[segB.startIdx] = { x: avgAxis, y: mid }
      pathB[segB.endIdx] = { x: avgAxis, y: mid }
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

/**
 * Remove zero-length segments and consecutive duplicate points from a
 * trace path.  This is called after merging to clean up collapsed segments.
 */
export function simplifyTracePath(path: Point[]): Point[] {
  if (path.length < 2) return path

  const result: Point[] = [path[0]]

  for (let i = 1; i < path.length; i++) {
    const prev = result[result.length - 1]
    const curr = path[i]
    // Skip if the current point is identical to the previous
    if (Math.abs(curr.x - prev.x) < 1e-9 && Math.abs(curr.y - prev.y) < 1e-9) {
      continue
    }
    result.push(curr)
  }

  return result
}
