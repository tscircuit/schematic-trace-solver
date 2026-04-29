import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { GraphicsObject, Line } from "graphics-debug"
import type { Point } from "@tscircuit/math-utils"

/**
 * This solver finds traces that belong to the same net and have segments
 * that are parallel and close together (at the same Y for horizontal segments
 * or the same X for vertical segments), then merges them so they share
 * the same coordinate.
 *
 * For example, if two traces from the same net both have horizontal segments
 * at Y=1.0 and Y=1.05, this solver will adjust one to match the other,
 * effectively merging the parallel paths.
 */
export class SameNetTraceMergerSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]

  /** Threshold for considering two segments "close together" */
  MERGE_THRESHOLD = 0.15

  /** Traces grouped by net */
  traceNetGroups: Record<string, SolvedTracePath[]> = {}

  constructor(params: {
    inputProblem: InputProblem
    traces: SolvedTracePath[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.traces
    this.outputTraces = params.traces.map((t) => ({
      ...t,
      tracePath: t.tracePath.map((p) => ({ ...p })),
    }))

    // Group traces by net
    for (const trace of this.outputTraces) {
      const netId = trace.globalConnNetId
      if (!this.traceNetGroups[netId]) {
        this.traceNetGroups[netId] = []
      }
      this.traceNetGroups[netId].push(trace)
    }
  }

  override getConstructorParams() {
    return {
      inputProblem: this.inputProblem,
      traces: this.inputTraces,
    }
  }

  override _step() {
    const EPS = 1e-6

    // Process each net group
    for (const [netId, traces] of Object.entries(this.traceNetGroups)) {
      if (traces.length < 2) continue

      // Find and merge close parallel segments
      this.mergeCloseParallelSegments(traces)
    }

    // Clean up paths by removing collinear points and duplicates
    for (const trace of this.outputTraces) {
      trace.tracePath = this.simplifyPath(trace.tracePath)
    }

    this.solved = true
  }

  /**
   * Merge close parallel segments within a group of traces from the same net.
   * We find pairs of traces with parallel segments that are close together
   * and align them to the same coordinate.
   */
  private mergeCloseParallelSegments(traces: SolvedTracePath[]) {
    const EPS = 1e-6
    const THRESHOLD = this.MERGE_THRESHOLD

    // Build a map of trace index to trace path for quick lookup
    const tracePaths = traces.map((t) => t.tracePath)

    // For each pair of traces
    for (let i = 0; i < traces.length; i++) {
      for (let j = i + 1; j < traces.length; j++) {
        const pathA = tracePaths[i]!
        const pathB = tracePaths[j]!

        // Find parallel segments that are close together
        this.alignCloseParallelSegments(pathA, pathB, THRESHOLD)
      }
    }
  }

  /**
   * Find parallel segments in two paths that are close together and align them.
   */
  private alignCloseParallelSegments(
    pathA: Point[],
    pathB: Point[],
    threshold: number,
  ) {
    const EPS = 1e-6

    // For each segment in pathA
    for (let ai = 0; ai < pathA.length - 1; ai++) {
      const a1 = pathA[ai]!
      const a2 = pathA[ai + 1]!

      const aIsVertical = Math.abs(a1.x - a2.x) < EPS
      const aIsHorizontal = Math.abs(a1.y - a2.y) < EPS

      if (!aIsVertical && !aIsHorizontal) continue

      // For each segment in pathB
      for (let bi = 0; bi < pathB.length - 1; bi++) {
        const b1 = pathB[bi]!
        const b2 = pathB[bi + 1]!

        const bIsVertical = Math.abs(b1.x - b2.x) < EPS
        const bIsHorizontal = Math.abs(b1.y - b2.y) < EPS

        if (!bIsVertical && !bIsHorizontal) continue

        // Check if segments are parallel and close
        if (aIsHorizontal && bIsHorizontal) {
          // Both horizontal - check if Y coordinates are close
          const yDiff = Math.abs(a1.y - b1.y)
          if (yDiff > EPS && yDiff < threshold) {
            // Check if X ranges overlap
            const aMinX = Math.min(a1.x, a2.x)
            const aMaxX = Math.max(a1.x, a2.x)
            const bMinX = Math.min(b1.x, b2.x)
            const bMaxX = Math.max(b1.x, b2.x)

            const overlapMinX = Math.max(aMinX, bMinX)
            const overlapMaxX = Math.min(aMaxX, bMaxX)

            if (overlapMaxX - overlapMinX > EPS) {
              // Segments overlap in X - align B's Y to A's Y
              this.adjustSegmentY(pathB, bi, a1.y)
            }
          }
        } else if (aIsVertical && bIsVertical) {
          // Both vertical - check if X coordinates are close
          const xDiff = Math.abs(a1.x - b1.x)
          if (xDiff > EPS && xDiff < threshold) {
            // Check if Y ranges overlap
            const aMinY = Math.min(a1.y, a2.y)
            const aMaxY = Math.max(a1.y, a2.y)
            const bMinY = Math.min(b1.y, b2.y)
            const bMaxY = Math.max(b1.y, b2.y)

            const overlapMinY = Math.max(aMinY, bMinY)
            const overlapMaxY = Math.min(aMaxY, bMaxY)

            if (overlapMaxY - overlapMinY > EPS) {
              // Segments overlap in Y - align B's X to A's X
              this.adjustSegmentX(pathB, bi, a1.x)
            }
          }
        }
      }
    }
  }

  /**
   * Adjust a horizontal segment's Y coordinate and handle adjacent segments.
   */
  private adjustSegmentY(path: Point[], segmentIndex: number, newY: number) {
    const EPS = 1e-6
    const p1 = path[segmentIndex]!
    const p2 = path[segmentIndex + 1]!

    // Update the segment's Y coordinate
    p1.y = newY
    p2.y = newY

    // Handle adjacent segments to maintain orthogonality
    // Previous segment (if exists)
    if (segmentIndex > 0) {
      const p0 = path[segmentIndex - 1]!
      // Previous segment should be vertical, update its endpoint
      p0.x = p1.x // Ensure it connects properly
    }

    // Next segment (if exists)
    if (segmentIndex + 2 < path.length) {
      const p3 = path[segmentIndex + 2]!
      // Next segment should be vertical, update its startpoint
      p3.x = p2.x // Ensure it connects properly
    }
  }

  /**
   * Adjust a vertical segment's X coordinate and handle adjacent segments.
   */
  private adjustSegmentX(path: Point[], segmentIndex: number, newX: number) {
    const EPS = 1e-6
    const p1 = path[segmentIndex]!
    const p2 = path[segmentIndex + 1]!

    // Update the segment's X coordinate
    p1.x = newX
    p2.x = newX

    // Handle adjacent segments to maintain orthogonality
    // Previous segment (if exists)
    if (segmentIndex > 0) {
      const p0 = path[segmentIndex - 1]!
      // Previous segment should be horizontal, update its endpoint
      p0.y = p1.y // Ensure it connects properly
    }

    // Next segment (if exists)
    if (segmentIndex + 2 < path.length) {
      const p3 = path[segmentIndex + 2]!
      // Next segment should be horizontal, update its startpoint
      p3.y = p2.y // Ensure it connects properly
    }
  }

  /**
   * Simplify a path by removing collinear points and consecutive duplicates.
   */
  private simplifyPath(path: Point[]): Point[] {
    const EPS = 1e-6
    if (path.length <= 2) return path

    const simplified: Point[] = [path[0]!]

    for (let i = 1; i < path.length - 1; i++) {
      const prev = simplified[simplified.length - 1]!
      const curr = path[i]!
      const next = path[i + 1]!

      // Check if current point is collinear with prev and next
      const isHorizontal =
        Math.abs(prev.y - curr.y) < EPS && Math.abs(curr.y - next.y) < EPS
      const isVertical =
        Math.abs(prev.x - curr.x) < EPS && Math.abs(curr.x - next.x) < EPS

      // Skip collinear points (they're redundant)
      if (isHorizontal || isVertical) {
        continue
      }

      // Skip duplicate points
      if (Math.abs(prev.x - curr.x) < EPS && Math.abs(prev.y - curr.y) < EPS) {
        continue
      }

      simplified.push(curr)
    }

    // Always add the last point
    simplified.push(path[path.length - 1]!)

    // Remove consecutive duplicates from the final result
    const result: Point[] = []
    for (const p of simplified) {
      if (
        result.length === 0 ||
        Math.abs(result[result.length - 1]!.x - p.x) > EPS ||
        Math.abs(result[result.length - 1]!.y - p.y) > EPS
      ) {
        result.push({ ...p })
      }
    }

    return result
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    if (!graphics.lines) graphics.lines = []
    if (!graphics.points) graphics.points = []
    if (!graphics.rects) graphics.rects = []
    if (!graphics.circles) graphics.circles = []
    if (!graphics.texts) graphics.texts = []

    // Draw all traces
    for (const trace of this.outputTraces) {
      const line: Line = {
        points: trace.tracePath,
        strokeColor: "blue",
      }
      graphics.lines!.push(line)
    }

    return graphics
  }
}
