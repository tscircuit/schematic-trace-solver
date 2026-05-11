import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

type SegmentOrientation = "horizontal" | "vertical"

type SegmentCandidate = {
  traceIndex: number
  segmentIndex: number
  trace: SolvedTracePath
  orientation: SegmentOrientation
  fixedAxisValue: number
  rangeStart: number
  rangeEnd: number
}

export type SameNetTraceConsolidationSolverInput = {
  traces: SolvedTracePath[]
  mergeDistance?: number
  minimumOverlap?: number
}

const EPS = 1e-9

export class SameNetTraceConsolidationSolver extends BaseSolver {
  outputTraces: SolvedTracePath[]
  movedSegments: Array<{
    mspPairId: string
    segmentIndex: number
    orientation: SegmentOrientation
    from: number
    to: number
  }> = []

  private mergeDistance: number
  private minimumOverlap: number

  constructor(input: SameNetTraceConsolidationSolverInput) {
    super()
    this.outputTraces = input.traces.map(cloneTrace)
    this.mergeDistance = input.mergeDistance ?? 0.15
    this.minimumOverlap = input.minimumOverlap ?? 0.05
  }

  override _step() {
    this.consolidateSameNetRuns()
    this.solved = true
  }

  private consolidateSameNetRuns() {
    for (let pass = 0; pass < 10; pass++) {
      const mergeCandidates = this.findMergeCandidates()
      const appliedMerge = mergeCandidates.some((merge) =>
        this.tryApplyMerge(merge.moving, merge.target),
      )
      if (!appliedMerge) return
    }
  }

  private findMergeCandidates(): Array<{
    moving: SegmentCandidate
    target: SegmentCandidate
    distance: number
    overlap: number
  }> {
    const segments = this.collectSegments()
    const mergeCandidates: Array<{
      moving: SegmentCandidate
      target: SegmentCandidate
      distance: number
      overlap: number
    }> = []

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const first = segments[i]!
        const second = segments[j]!
        if (!this.areMergeCandidates(first, second)) continue

        const firstInternal = this.isInternalSegment(first)
        const secondInternal = this.isInternalSegment(second)
        if (!firstInternal && !secondInternal) continue

        const distance = Math.abs(first.fixedAxisValue - second.fixedAxisValue)
        const overlap = getOverlapLength(first, second)
        let moving: SegmentCandidate
        let target: SegmentCandidate

        if (firstInternal && !secondInternal) {
          moving = first
          target = second
        } else if (secondInternal && !firstInternal) {
          moving = second
          target = first
        } else if (this.lengthOf(first) <= this.lengthOf(second)) {
          moving = first
          target = second
        } else {
          moving = second
          target = first
        }

        mergeCandidates.push({ moving, target, distance, overlap })
      }
    }

    return mergeCandidates.sort(
      (a, b) => a.distance - b.distance || b.overlap - a.overlap,
    )
  }

  private collectSegments(): SegmentCandidate[] {
    const segments: SegmentCandidate[] = []

    for (
      let traceIndex = 0;
      traceIndex < this.outputTraces.length;
      traceIndex++
    ) {
      const trace = this.outputTraces[traceIndex]!
      for (
        let segmentIndex = 0;
        segmentIndex < trace.tracePath.length - 1;
        segmentIndex++
      ) {
        const start = trace.tracePath[segmentIndex]!
        const end = trace.tracePath[segmentIndex + 1]!

        if (Math.abs(start.y - end.y) < EPS) {
          segments.push({
            traceIndex,
            segmentIndex,
            trace,
            orientation: "horizontal",
            fixedAxisValue: start.y,
            rangeStart: Math.min(start.x, end.x),
            rangeEnd: Math.max(start.x, end.x),
          })
        } else if (Math.abs(start.x - end.x) < EPS) {
          segments.push({
            traceIndex,
            segmentIndex,
            trace,
            orientation: "vertical",
            fixedAxisValue: start.x,
            rangeStart: Math.min(start.y, end.y),
            rangeEnd: Math.max(start.y, end.y),
          })
        }
      }
    }

    return segments
  }

  private areMergeCandidates(a: SegmentCandidate, b: SegmentCandidate) {
    if (a.trace.mspPairId === b.trace.mspPairId) return false
    if (a.trace.globalConnNetId !== b.trace.globalConnNetId) return false
    if (a.orientation !== b.orientation) return false
    if (Math.abs(a.fixedAxisValue - b.fixedAxisValue) > this.mergeDistance) {
      return false
    }

    return getOverlapLength(a, b) >= this.minimumOverlap
  }

  private tryApplyMerge(
    moving: SegmentCandidate,
    target: SegmentCandidate,
  ): boolean {
    if (Math.abs(moving.fixedAxisValue - target.fixedAxisValue) < EPS) {
      return false
    }

    const nextTraces = this.outputTraces.map(cloneTrace)
    const movingTrace = nextTraces[moving.traceIndex]!
    const p0 = movingTrace.tracePath[moving.segmentIndex]!
    const p1 = movingTrace.tracePath[moving.segmentIndex + 1]!

    if (moving.orientation === "horizontal") {
      p0.y = target.fixedAxisValue
      p1.y = target.fixedAxisValue
    } else {
      p0.x = target.fixedAxisValue
      p1.x = target.fixedAxisValue
    }

    if (this.hasDifferentNetIntersection(nextTraces, moving.traceIndex)) {
      return false
    }

    this.outputTraces = nextTraces
    this.movedSegments.push({
      mspPairId: moving.trace.mspPairId,
      segmentIndex: moving.segmentIndex,
      orientation: moving.orientation,
      from: moving.fixedAxisValue,
      to: target.fixedAxisValue,
    })
    return true
  }

  private hasDifferentNetIntersection(
    traces: SolvedTracePath[],
    changedTraceIndex: number,
  ) {
    const changedTrace = traces[changedTraceIndex]!
    const changedSegments = getTraceSegments(changedTrace)

    for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
      if (traceIndex === changedTraceIndex) continue
      const otherTrace = traces[traceIndex]!
      if (otherTrace.globalConnNetId === changedTrace.globalConnNetId) {
        continue
      }

      for (const changed of changedSegments) {
        for (const other of getTraceSegments(otherTrace)) {
          if (segmentsIntersect(changed[0], changed[1], other[0], other[1])) {
            return true
          }
        }
      }
    }

    return false
  }

  private isInternalSegment(segment: SegmentCandidate) {
    return (
      segment.segmentIndex > 0 &&
      segment.segmentIndex < segment.trace.tracePath.length - 2
    )
  }

  private lengthOf(segment: SegmentCandidate) {
    return segment.rangeEnd - segment.rangeStart
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      movedSegments: this.movedSegments,
    }
  }

  override visualize(): GraphicsObject {
    const lines: Line[] = this.outputTraces.map((trace) => ({
      points: trace.tracePath.map((point) => ({ x: point.x, y: point.y })),
      strokeColor: "blue",
    }))

    return { lines, points: [], rects: [], circles: [] }
  }
}

function cloneTrace(trace: SolvedTracePath): SolvedTracePath {
  return {
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }
}

function getTraceSegments(trace: SolvedTracePath): Array<[Point, Point]> {
  const segments: Array<[Point, Point]> = []
  for (let i = 0; i < trace.tracePath.length - 1; i++) {
    segments.push([trace.tracePath[i]!, trace.tracePath[i + 1]!])
  }
  return segments
}

function getOverlapLength(a: SegmentCandidate, b: SegmentCandidate) {
  return Math.max(
    0,
    Math.min(a.rangeEnd, b.rangeEnd) - Math.max(a.rangeStart, b.rangeStart),
  )
}

function segmentsIntersect(a0: Point, a1: Point, b0: Point, b1: Point) {
  const aHorizontal = Math.abs(a0.y - a1.y) < EPS
  const aVertical = Math.abs(a0.x - a1.x) < EPS
  const bHorizontal = Math.abs(b0.y - b1.y) < EPS
  const bVertical = Math.abs(b0.x - b1.x) < EPS

  if (aHorizontal && bHorizontal) {
    return Math.abs(a0.y - b0.y) < EPS && rangesOverlap(a0.x, a1.x, b0.x, b1.x)
  }

  if (aVertical && bVertical) {
    return Math.abs(a0.x - b0.x) < EPS && rangesOverlap(a0.y, a1.y, b0.y, b1.y)
  }

  const horizontal = aHorizontal ? [a0, a1] : [b0, b1]
  const vertical = aVertical ? [a0, a1] : [b0, b1]
  const horizontalMinX = Math.min(horizontal[0]!.x, horizontal[1]!.x)
  const horizontalMaxX = Math.max(horizontal[0]!.x, horizontal[1]!.x)
  const horizontalY = horizontal[0]!.y
  const verticalX = vertical[0]!.x
  const verticalMinY = Math.min(vertical[0]!.y, vertical[1]!.y)
  const verticalMaxY = Math.max(vertical[0]!.y, vertical[1]!.y)

  return (
    verticalX >= horizontalMinX - EPS &&
    verticalX <= horizontalMaxX + EPS &&
    horizontalY >= verticalMinY - EPS &&
    horizontalY <= verticalMaxY + EPS
  )
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number) {
  return (
    Math.min(Math.max(a0, a1), Math.max(b0, b1)) -
      Math.max(Math.min(a0, a1), Math.min(b0, b1)) >=
    EPS
  )
}
