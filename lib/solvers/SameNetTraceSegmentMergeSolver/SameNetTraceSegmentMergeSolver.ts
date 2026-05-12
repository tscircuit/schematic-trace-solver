import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

type Orientation = "horizontal" | "vertical"

interface SegmentRef {
  trace: SolvedTracePath
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  fixedCoord: number
  start: number
  end: number
  length: number
  movable: boolean
}

interface SameNetTraceSegmentMergeSolverInput {
  traces: SolvedTracePath[]
  coordinateMergeDistance?: number
  spanMergeDistance?: number
  maxPasses?: number
}

const DEFAULT_COORDINATE_MERGE_DISTANCE = 0.12
const DEFAULT_SPAN_MERGE_DISTANCE = 0.35
const EPS = 1e-6

const getOrientation = (p1: Point, p2: Point): Orientation | null => {
  if (Math.abs(p1.y - p2.y) < EPS) return "horizontal"
  if (Math.abs(p1.x - p2.x) < EPS) return "vertical"
  return null
}

const clonePoint = (p: Point): Point => ({ x: p.x, y: p.y })

const normalizeSpan = (a: number, b: number) => ({
  start: Math.min(a, b),
  end: Math.max(a, b),
})

const spansAreClose = (
  a: Pick<SegmentRef, "start" | "end">,
  b: Pick<SegmentRef, "start" | "end">,
  maxGap: number,
) => {
  const gap = Math.max(a.start, b.start) - Math.min(a.end, b.end)
  return gap <= maxGap
}

export class SameNetTraceSegmentMergeSolver extends BaseSolver {
  private traces: SolvedTracePath[]
  private coordinateMergeDistance: number
  private spanMergeDistance: number

  mergedSegmentCount = 0

  constructor(params: SameNetTraceSegmentMergeSolverInput) {
    super()
    this.traces = params.traces.map((trace) => ({
      ...trace,
      tracePath: trace.tracePath.map(clonePoint),
    }))
    this.coordinateMergeDistance =
      params.coordinateMergeDistance ?? DEFAULT_COORDINATE_MERGE_DISTANCE
    this.spanMergeDistance =
      params.spanMergeDistance ?? DEFAULT_SPAN_MERGE_DISTANCE
    this.MAX_ITERATIONS = params.maxPasses ?? 500
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceSegmentMergeSolver
  >[0] {
    return {
      traces: this.traces,
      coordinateMergeDistance: this.coordinateMergeDistance,
      spanMergeDistance: this.spanMergeDistance,
      maxPasses: this.MAX_ITERATIONS,
    }
  }

  override _step() {
    const merge = this.findNextMerge()
    if (!merge) {
      this.solved = true
      return
    }

    this.alignSegment(merge.segmentToMove, merge.targetCoord)
    this.mergedSegmentCount++
  }

  private findNextMerge(): {
    segmentToMove: SegmentRef
    targetCoord: number
  } | null {
    const segmentsByNet = new Map<string, SegmentRef[]>()

    this.traces.forEach((trace, traceIndex) => {
      for (
        let segmentIndex = 0;
        segmentIndex < trace.tracePath.length - 1;
        segmentIndex++
      ) {
        const segment = this.getSegmentRef(trace, traceIndex, segmentIndex)
        if (!segment) continue
        const segments = segmentsByNet.get(trace.globalConnNetId) ?? []
        segments.push(segment)
        segmentsByNet.set(trace.globalConnNetId, segments)
      }
    })

    for (const segments of segmentsByNet.values()) {
      for (let i = 0; i < segments.length; i++) {
        const a = segments[i]!
        for (let j = i + 1; j < segments.length; j++) {
          const b = segments[j]!
          if (a.trace.mspPairId === b.trace.mspPairId) continue
          if (a.orientation !== b.orientation) continue
          const coordDelta = Math.abs(a.fixedCoord - b.fixedCoord)
          if (coordDelta < EPS || coordDelta > this.coordinateMergeDistance)
            continue
          if (!spansAreClose(a, b, this.spanMergeDistance)) continue

          const segmentToMove = this.chooseSegmentToMove(a, b)
          if (!segmentToMove) continue

          const fixedSegment = segmentToMove === a ? b : a
          return {
            segmentToMove,
            targetCoord: fixedSegment.fixedCoord,
          }
        }
      }
    }

    return null
  }

  private getSegmentRef(
    trace: SolvedTracePath,
    traceIndex: number,
    segmentIndex: number,
  ): SegmentRef | null {
    const p1 = trace.tracePath[segmentIndex]!
    const p2 = trace.tracePath[segmentIndex + 1]!
    const orientation = getOrientation(p1, p2)
    if (!orientation) return null

    const span =
      orientation === "horizontal"
        ? normalizeSpan(p1.x, p2.x)
        : normalizeSpan(p1.y, p2.y)

    return {
      trace,
      traceIndex,
      segmentIndex,
      orientation,
      fixedCoord: orientation === "horizontal" ? p1.y : p1.x,
      start: span.start,
      end: span.end,
      length: span.end - span.start,
      movable: this.isInteriorSegment(trace, segmentIndex),
    }
  }

  private isInteriorSegment(trace: SolvedTracePath, segmentIndex: number) {
    return segmentIndex > 0 && segmentIndex < trace.tracePath.length - 2
  }

  private chooseSegmentToMove(a: SegmentRef, b: SegmentRef) {
    if (a.movable && !b.movable) return a
    if (b.movable && !a.movable) return b
    if (!a.movable && !b.movable) return null
    if (a.length < b.length) return a
    if (b.length < a.length) return b
    return a.trace.mspPairId > b.trace.mspPairId ? a : b
  }

  private alignSegment(segment: SegmentRef, targetCoord: number) {
    const trace = this.traces[segment.traceIndex]!
    const tracePath = trace.tracePath.map(clonePoint)
    const p1 = tracePath[segment.segmentIndex]!
    const p2 = tracePath[segment.segmentIndex + 1]!

    if (segment.orientation === "horizontal") {
      p1.y = targetCoord
      p2.y = targetCoord
    } else {
      p1.x = targetCoord
      p2.x = targetCoord
    }

    this.traces[segment.traceIndex] = {
      ...trace,
      tracePath: simplifyPath(tracePath),
    }
  }

  getOutput() {
    return {
      traces: this.traces,
      mergedSegmentCount: this.mergedSegmentCount,
    }
  }

  override visualize(): GraphicsObject {
    const lines: Line[] = []

    for (const trace of this.traces) {
      lines.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    return { lines, points: [], rects: [], circles: [] }
  }
}
