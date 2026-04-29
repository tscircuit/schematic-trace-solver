import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject } from "graphics-debug"
import type { Point } from "@tscircuit/math-utils"

/**
 * Threshold distance for considering two parallel segments as "close enough" to merge.
 */
const GAP_THRESHOLD = 0.15

interface Segment {
  p1: Point
  p2: Point
}

interface SameNetTraceMergeSolverInput {
  inputProblem: InputProblem
  allTraces: SolvedTracePath[]
}

/**
 * This solver combines same-net trace segments that are close together.
 * After trace cleanup, there can be multiple trace paths on the same net
 * that run parallel and close to each other. This phase detects those
 * parallel segments and merges them into a single path to produce cleaner
 * schematic output.
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  private input: SameNetTraceMergeSolverInput
  private outputTraces: SolvedTracePath[]

  constructor(solverInput: SameNetTraceMergeSolverInput) {
    super()
    this.input = solverInput
    this.outputTraces = [...solverInput.allTraces]
  }

  override _step() {
    this.mergeCloseParallelSegments()
    this.solved = true
  }

  /**
   * Groups traces by globalConnNetId and merges parallel segments
   * within the same net that are within GAP_THRESHOLD of each other.
   */
  private mergeCloseParallelSegments() {
    // Group traces by net
    const tracesByNet = new Map<string, SolvedTracePath[]>()
    for (const trace of this.outputTraces) {
      const netId = trace.globalConnNetId
      if (!tracesByNet.has(netId)) {
        tracesByNet.set(netId, [])
      }
      tracesByNet.get(netId)!.push(trace)
    }

    // For each net with multiple traces, look for merge opportunities
    for (const [_netId, traces] of tracesByNet) {
      if (traces.length < 2) continue
      this.mergeTracesInNet(traces)
    }
  }

  /**
   * Given a set of traces on the same net, find pairs of parallel segments
   * that are close together and merge them.
   */
  private mergeTracesInNet(traces: SolvedTracePath[]) {
    for (let i = 0; i < traces.length; i++) {
      for (let j = i + 1; j < traces.length; j++) {
        const traceA = traces[i]!
        const traceB = traces[j]!
        this.tryMergeTracePair(traceA, traceB)
      }
    }
  }

  /**
   * Given two traces on the same net, find parallel segments that are
   * close together and merge them by shifting the closer one onto the other.
   */
  private tryMergeTracePair(traceA: SolvedTracePath, traceB: SolvedTracePath) {
    const segmentsA = this.getSegments(traceA.tracePath)
    const segmentsB = this.getSegments(traceB.tracePath)

    for (const segA of segmentsA) {
      for (const segB of segmentsB) {
        const mergeResult = this.canMergeSegments(segA, segB)
        if (mergeResult) {
          // Merge by shifting segB's coordinate to match segA
          this.applyMerge(traceB.tracePath, segB, mergeResult)
        }
      }
    }
  }

  private getSegments(path: Point[]): Segment[] {
    const segments: Segment[] = []
    for (let i = 0; i < path.length - 1; i++) {
      segments.push({ p1: path[i]!, p2: path[i + 1]! })
    }
    return segments
  }

  /**
   * Check if two segments are parallel, close, and have overlapping extent.
   * Returns the target coordinate to shift to, or null.
   */
  private canMergeSegments(
    segA: Segment,
    segB: Segment,
  ): { direction: "horizontal" | "vertical"; targetCoord: number } | null {
    const isAHorizontal =
      Math.abs(segA.p1.y - segA.p2.y) < 1e-6 &&
      Math.abs(segA.p1.x - segA.p2.x) > 1e-6
    const isBHorizontal =
      Math.abs(segB.p1.y - segB.p2.y) < 1e-6 &&
      Math.abs(segB.p1.x - segB.p2.x) > 1e-6
    const isAVertical =
      Math.abs(segA.p1.x - segA.p2.x) < 1e-6 &&
      Math.abs(segA.p1.y - segA.p2.y) > 1e-6
    const isBVertical =
      Math.abs(segB.p1.x - segB.p2.x) < 1e-6 &&
      Math.abs(segB.p1.y - segB.p2.y) > 1e-6

    // Both horizontal
    if (isAHorizontal && isBHorizontal) {
      const gap = Math.abs(segA.p1.y - segB.p1.y)
      if (gap > 1e-6 && gap <= GAP_THRESHOLD) {
        // Check overlapping x-range
        const aMinX = Math.min(segA.p1.x, segA.p2.x)
        const aMaxX = Math.max(segA.p1.x, segA.p2.x)
        const bMinX = Math.min(segB.p1.x, segB.p2.x)
        const bMaxX = Math.max(segB.p1.x, segB.p2.x)
        const overlapStart = Math.max(aMinX, bMinX)
        const overlapEnd = Math.min(aMaxX, bMaxX)
        if (overlapEnd > overlapStart + 1e-6) {
          return { direction: "horizontal", targetCoord: segA.p1.y }
        }
      }
    }

    // Both vertical
    if (isAVertical && isBVertical) {
      const gap = Math.abs(segA.p1.x - segB.p1.x)
      if (gap > 1e-6 && gap <= GAP_THRESHOLD) {
        // Check overlapping y-range
        const aMinY = Math.min(segA.p1.y, segA.p2.y)
        const aMaxY = Math.max(segA.p1.y, segA.p2.y)
        const bMinY = Math.min(segB.p1.y, segB.p2.y)
        const bMaxY = Math.max(segB.p1.y, segB.p2.y)
        const overlapStart = Math.max(aMinY, bMinY)
        const overlapEnd = Math.min(aMaxY, bMaxY)
        if (overlapEnd > overlapStart + 1e-6) {
          return { direction: "vertical", targetCoord: segA.p1.x }
        }
      }
    }

    return null
  }

  /**
   * Apply a merge by shifting the segment's coordinate in the trace path
   * to match the target. This modifies the trace path in place.
   */
  private applyMerge(
    path: Point[],
    seg: Segment,
    mergeResult: { direction: "horizontal" | "vertical"; targetCoord: number },
  ) {
    // Capture original coordinates before modification (seg points are references to path points)
    const origY = seg.p1.y
    const origX = seg.p1.x
    const minX = Math.min(seg.p1.x, seg.p2.x)
    const maxX = Math.max(seg.p1.x, seg.p2.x)
    const minY = Math.min(seg.p1.y, seg.p2.y)
    const maxY = Math.max(seg.p1.y, seg.p2.y)

    for (const point of path) {
      if (mergeResult.direction === "horizontal") {
        if (
          Math.abs(point.y - origY) < 1e-6 &&
          point.x >= minX - 1e-6 &&
          point.x <= maxX + 1e-6
        ) {
          point.y = mergeResult.targetCoord
        }
      } else {
        if (
          Math.abs(point.x - origX) < 1e-6 &&
          point.y >= minY - 1e-6 &&
          point.y <= maxY + 1e-6
        ) {
          point.x = mergeResult.targetCoord
        }
      }
    }
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    return {
      lines: this.outputTraces.map((trace) => ({
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "blue",
      })),
      points: [],
      rects: [],
      circles: [],
    }
  }
}
