import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

const EPS = 1e-6

interface SegmentLocator {
  traceIndex: number
  segmentIndex: number
  orientation: "horizontal" | "vertical"
  fixedCoord: number
  start: number
  end: number
  length: number
}

export class SameNetTraceAlignmentSolver extends BaseSolver {
  private inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  alignmentTolerance: number

  constructor(params: {
    traces: SolvedTracePath[]
    alignmentTolerance?: number
  }) {
    super()
    this.inputTraces = params.traces
    this.outputTraces = params.traces.map((trace) => ({
      ...trace,
      tracePath: trace.tracePath.map((point) => ({ ...point })),
    }))
    this.alignmentTolerance = params.alignmentTolerance ?? 0.2
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceAlignmentSolver
  >[0] {
    return {
      traces: this.inputTraces,
      alignmentTolerance: this.alignmentTolerance,
    }
  }

  override _step() {
    const changed = this.alignNextSegmentPair()
    if (!changed) {
      this.solved = true
    }
  }

  private alignNextSegmentPair(): boolean {
    const netIds = Array.from(
      new Set(this.outputTraces.map((trace) => trace.globalConnNetId)),
    )

    for (const netId of netIds) {
      const traceIndexes = this.outputTraces
        .map((trace, traceIndex) => ({ trace, traceIndex }))
        .filter(({ trace }) => trace.globalConnNetId === netId)
        .map(({ traceIndex }) => traceIndex)

      for (let i = 0; i < traceIndexes.length; i++) {
        for (let j = i + 1; j < traceIndexes.length; j++) {
          const traceIndexA = traceIndexes[i]!
          const traceIndexB = traceIndexes[j]!
          const segmentsA = this.getInteriorSegments(traceIndexA)
          const segmentsB = this.getInteriorSegments(traceIndexB)

          for (const segmentA of segmentsA) {
            for (const segmentB of segmentsB) {
              if (segmentA.orientation !== segmentB.orientation) continue
              const fixedCoordDistance = Math.abs(
                segmentA.fixedCoord - segmentB.fixedCoord,
              )
              if (
                fixedCoordDistance <= EPS ||
                fixedCoordDistance > this.alignmentTolerance
              ) {
                continue
              }
              if (!rangesOverlap(segmentA, segmentB)) continue

              const [segmentToMove, targetCoord] =
                segmentA.length <= segmentB.length
                  ? [segmentA, segmentB.fixedCoord]
                  : [segmentB, segmentA.fixedCoord]

              if (this.wouldOverlapDifferentNet(segmentToMove, targetCoord)) {
                continue
              }

              this.moveSegment(segmentToMove, targetCoord)
              return true
            }
          }
        }
      }
    }

    return false
  }

  private getInteriorSegments(traceIndex: number): SegmentLocator[] {
    const trace = this.outputTraces[traceIndex]!
    const segments: SegmentLocator[] = []
    const path = trace.tracePath

    for (let segmentIndex = 1; segmentIndex < path.length - 2; segmentIndex++) {
      const p1 = path[segmentIndex]!
      const p2 = path[segmentIndex + 1]!
      const horizontal = Math.abs(p1.y - p2.y) < EPS
      const vertical = Math.abs(p1.x - p2.x) < EPS
      if (!horizontal && !vertical) continue

      const start = horizontal ? Math.min(p1.x, p2.x) : Math.min(p1.y, p2.y)
      const end = horizontal ? Math.max(p1.x, p2.x) : Math.max(p1.y, p2.y)
      const length = end - start
      if (length <= EPS) continue

      segments.push({
        traceIndex,
        segmentIndex,
        orientation: horizontal ? "horizontal" : "vertical",
        fixedCoord: horizontal ? p1.y : p1.x,
        start,
        end,
        length,
      })
    }

    return segments
  }

  private wouldOverlapDifferentNet(
    segment: SegmentLocator,
    targetCoord: number,
  ) {
    const movingTrace = this.outputTraces[segment.traceIndex]!
    const movedSegment = {
      ...segment,
      fixedCoord: targetCoord,
    }

    for (
      let traceIndex = 0;
      traceIndex < this.outputTraces.length;
      traceIndex++
    ) {
      const trace = this.outputTraces[traceIndex]!
      if (trace.globalConnNetId === movingTrace.globalConnNetId) continue

      for (const otherSegment of this.getAllSegments(traceIndex)) {
        if (segmentsCoincidentlyOverlap(movedSegment, otherSegment)) {
          return true
        }
      }
    }

    return false
  }

  private getAllSegments(traceIndex: number): SegmentLocator[] {
    const trace = this.outputTraces[traceIndex]!
    const segments: SegmentLocator[] = []
    const path = trace.tracePath

    for (let segmentIndex = 0; segmentIndex < path.length - 1; segmentIndex++) {
      const p1 = path[segmentIndex]!
      const p2 = path[segmentIndex + 1]!
      const horizontal = Math.abs(p1.y - p2.y) < EPS
      const vertical = Math.abs(p1.x - p2.x) < EPS
      if (!horizontal && !vertical) continue

      const start = horizontal ? Math.min(p1.x, p2.x) : Math.min(p1.y, p2.y)
      const end = horizontal ? Math.max(p1.x, p2.x) : Math.max(p1.y, p2.y)
      const length = end - start
      if (length <= EPS) continue

      segments.push({
        traceIndex,
        segmentIndex,
        orientation: horizontal ? "horizontal" : "vertical",
        fixedCoord: horizontal ? p1.y : p1.x,
        start,
        end,
        length,
      })
    }

    return segments
  }

  private moveSegment(segment: SegmentLocator, targetCoord: number) {
    const trace = this.outputTraces[segment.traceIndex]!
    const path = trace.tracePath.map((point) => ({ ...point }))
    const p1 = path[segment.segmentIndex]!
    const p2 = path[segment.segmentIndex + 1]!

    if (segment.orientation === "horizontal") {
      p1.y = targetCoord
      p2.y = targetCoord
    } else {
      p1.x = targetCoord
      p2.x = targetCoord
    }

    this.outputTraces[segment.traceIndex] = {
      ...trace,
      tracePath: simplifyPath(path as Point[]),
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
        points: trace.tracePath,
        strokeColor: "green",
      })),
      points: [],
      rects: [],
      circles: [],
    }
  }
}

const rangesOverlap = (a: SegmentLocator, b: SegmentLocator) => {
  const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start)
  return overlap > EPS
}

const segmentsCoincidentlyOverlap = (a: SegmentLocator, b: SegmentLocator) => {
  if (a.orientation !== b.orientation) return false
  if (Math.abs(a.fixedCoord - b.fixedCoord) > EPS) return false
  return rangesOverlap(a, b)
}
