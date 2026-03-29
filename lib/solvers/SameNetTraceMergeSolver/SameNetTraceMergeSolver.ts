import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { Point } from "@tscircuit/math-utils"

/**
 * Gap threshold: if two parallel segments on the same net are closer than this,
 * they are candidates for merging.
 */
const GAP_THRESHOLD = 0.15

interface SameNetTraceMergeSolverInput {
  inputProblem: InputProblem
  allTraces: SolvedTracePath[]
}

interface Segment {
  traceIndex: number
  segmentIndex: number
  p1: Point
  p2: Point
  direction: "horizontal" | "vertical"
  /** The fixed coordinate (y for horizontal, x for vertical) */
  fixedCoord: number
  /** Range along the variable axis */
  min: number
  max: number
}

/**
 * The SameNetTraceMergeSolver combines same-net trace segments that run
 * parallel and close together. When two traces on the same globalConnNetId
 * have parallel segments within GAP_THRESHOLD of each other, the solver
 * merges them by moving one segment to align with the other, producing
 * cleaner schematic layouts.
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  private input: SameNetTraceMergeSolverInput
  private outputTraces: SolvedTracePath[]
  private processed = false

  constructor(solverInput: SameNetTraceMergeSolverInput) {
    super()
    this.input = solverInput
    this.outputTraces = solverInput.allTraces.map((t) => ({
      ...t,
      tracePath: [...t.tracePath.map((p) => ({ ...p }))],
    }))
  }

  override _step() {
    if (this.processed) {
      this.solved = true
      return
    }

    this.mergeCloseSegments()
    this.processed = true
    this.solved = true
  }

  private mergeCloseSegments() {
    // Group traces by globalConnNetId
    const byNet: Record<string, number[]> = {}
    for (let i = 0; i < this.outputTraces.length; i++) {
      const trace = this.outputTraces[i]
      const netId = trace.globalConnNetId
      if (!byNet[netId]) byNet[netId] = []
      byNet[netId].push(i)
    }

    // For each net with multiple traces, find and merge close parallel segments
    for (const netId in byNet) {
      const traceIndices = byNet[netId]
      if (traceIndices.length < 2) continue

      // Extract all segments from traces in this net
      const segments: Segment[] = []
      for (const ti of traceIndices) {
        const path = this.outputTraces[ti].tracePath
        for (let si = 0; si < path.length - 1; si++) {
          const p1 = path[si]
          const p2 = path[si + 1]
          const dx = Math.abs(p2.x - p1.x)
          const dy = Math.abs(p2.y - p1.y)

          if (dx < 1e-9 && dy < 1e-9) continue // zero-length segment

          if (dy < 1e-9) {
            // Horizontal segment
            segments.push({
              traceIndex: ti,
              segmentIndex: si,
              p1,
              p2,
              direction: "horizontal",
              fixedCoord: p1.y,
              min: Math.min(p1.x, p2.x),
              max: Math.max(p1.x, p2.x),
            })
          } else if (dx < 1e-9) {
            // Vertical segment
            segments.push({
              traceIndex: ti,
              segmentIndex: si,
              p1,
              p2,
              direction: "vertical",
              fixedCoord: p1.x,
              min: Math.min(p1.y, p2.y),
              max: Math.max(p1.y, p2.y),
            })
          }
          // Non-orthogonal segments are ignored
        }
      }

      // Find pairs of close parallel segments from different traces
      for (let a = 0; a < segments.length; a++) {
        for (let b = a + 1; b < segments.length; b++) {
          const sa = segments[a]
          const sb = segments[b]

          // Must be from different traces
          if (sa.traceIndex === sb.traceIndex) continue
          // Must be same direction
          if (sa.direction !== sb.direction) continue

          const gap = Math.abs(sa.fixedCoord - sb.fixedCoord)
          if (gap < 1e-9 || gap > GAP_THRESHOLD) continue

          // Check that the segments overlap in the variable axis
          const overlapMin = Math.max(sa.min, sb.min)
          const overlapMax = Math.min(sa.max, sb.max)
          if (overlapMax - overlapMin < 1e-9) continue

          // Merge: move segment b to align with segment a's fixed coordinate
          this.alignSegment(sb, sa.fixedCoord)
        }
      }
    }

    // Clean up any zero-length segments created by merging
    for (const trace of this.outputTraces) {
      trace.tracePath = this.removeRedundantPoints(trace.tracePath)
    }
  }

  /**
   * Adjusts a segment's fixed coordinate (and the neighboring points in the
   * trace path) to align it with a target value.
   */
  private alignSegment(seg: Segment, targetFixedCoord: number) {
    const path = this.outputTraces[seg.traceIndex].tracePath
    const si = seg.segmentIndex

    if (seg.direction === "horizontal") {
      // Move the y coordinate of both endpoints to the target
      path[si] = { ...path[si], y: targetFixedCoord }
      path[si + 1] = { ...path[si + 1], y: targetFixedCoord }
    } else {
      // Move the x coordinate of both endpoints to the target
      path[si] = { ...path[si], x: targetFixedCoord }
      path[si + 1] = { ...path[si + 1], x: targetFixedCoord }
    }
  }

  /**
   * Removes consecutive duplicate points and collinear intermediate points.
   */
  private removeRedundantPoints(path: Point[]): Point[] {
    if (path.length <= 2) return path

    const result: Point[] = [path[0]]
    for (let i = 1; i < path.length; i++) {
      const prev = result[result.length - 1]
      const curr = path[i]

      // Skip duplicate points
      if (Math.abs(prev.x - curr.x) < 1e-9 && Math.abs(prev.y - curr.y) < 1e-9) {
        continue
      }

      // Check if current point is collinear with previous two
      if (result.length >= 2) {
        const pp = result[result.length - 2]
        const isCollinear =
          (Math.abs(pp.x - prev.x) < 1e-9 && Math.abs(prev.x - curr.x) < 1e-9) ||
          (Math.abs(pp.y - prev.y) < 1e-9 && Math.abs(prev.y - curr.y) < 1e-9)
        if (isCollinear) {
          result[result.length - 1] = curr
          continue
        }
      }

      result.push(curr)
    }

    return result
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
      graphics.lines!.push(line)
    }
    return graphics
  }
}
