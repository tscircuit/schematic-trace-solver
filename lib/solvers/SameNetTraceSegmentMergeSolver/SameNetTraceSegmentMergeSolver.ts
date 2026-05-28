import type { Point } from "@tscircuit/math-utils"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

type SegmentOrientation = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  segmentIndex: number
  orientation: SegmentOrientation
  axis: number
  min: number
  max: number
  length: number
  movable: boolean
}

export interface SameNetTraceSegmentMergeSolverParams {
  traces: SolvedTracePath[]
  mergeDistance?: number
  minOverlap?: number
  minOverlapRatio?: number
}

const EPS = 1e-6

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  tracePath: trace.tracePath.map((point) => ({ ...point })),
})

const pointsEqual = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

const isCollinear = (a: Point, b: Point, c: Point) =>
  (Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS) ||
  (Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS)

const simplifyPath = (path: Point[]) => {
  const withoutDuplicates: Point[] = []
  for (const point of path) {
    const last = withoutDuplicates[withoutDuplicates.length - 1]
    if (!last || !pointsEqual(last, point)) {
      withoutDuplicates.push(point)
    }
  }

  const simplified: Point[] = []
  for (const point of withoutDuplicates) {
    simplified.push(point)
    while (simplified.length >= 3) {
      const a = simplified[simplified.length - 3]!
      const b = simplified[simplified.length - 2]!
      const c = simplified[simplified.length - 1]!
      if (!isCollinear(a, b, c)) break
      simplified.splice(simplified.length - 2, 1)
    }
  }
  return simplified
}

const getSegment = (
  trace: SolvedTracePath,
  traceIndex: number,
  segmentIndex: number,
): SegmentRef | null => {
  const start = trace.tracePath[segmentIndex]!
  const end = trace.tracePath[segmentIndex + 1]!
  const isHorizontal = Math.abs(start.y - end.y) < EPS
  const isVertical = Math.abs(start.x - end.x) < EPS

  if (!isHorizontal && !isVertical) return null

  const orientation = isHorizontal ? "horizontal" : "vertical"
  const min =
    orientation === "horizontal"
      ? Math.min(start.x, end.x)
      : Math.min(start.y, end.y)
  const max =
    orientation === "horizontal"
      ? Math.max(start.x, end.x)
      : Math.max(start.y, end.y)
  const length = max - min

  if (length < EPS) return null

  return {
    traceIndex,
    segmentIndex,
    orientation,
    axis: orientation === "horizontal" ? start.y : start.x,
    min,
    max,
    length,
    movable: segmentIndex > 0 && segmentIndex + 1 < trace.tracePath.length - 1,
  }
}

const getOverlap = (a: SegmentRef, b: SegmentRef) =>
  Math.min(a.max, b.max) - Math.max(a.min, b.min)

export class SameNetTraceSegmentMergeSolver extends BaseSolver {
  private traces: SolvedTracePath[]
  private mergeDistance: number
  private minOverlap: number
  private minOverlapRatio: number

  constructor(params: SameNetTraceSegmentMergeSolverParams) {
    super()
    this.traces = params.traces.map(cloneTrace)
    this.mergeDistance = params.mergeDistance ?? 0.19
    this.minOverlap = params.minOverlap ?? 0.05
    this.minOverlapRatio = params.minOverlapRatio ?? 0.75
  }

  override getConstructorParams(): SameNetTraceSegmentMergeSolverParams {
    return {
      traces: this.traces,
      mergeDistance: this.mergeDistance,
      minOverlap: this.minOverlap,
      minOverlapRatio: this.minOverlapRatio,
    }
  }

  override _step() {
    let changed = true
    while (changed) {
      changed = this.mergeNextSegmentPair()
    }
    this.solved = true
  }

  private mergeNextSegmentPair() {
    for (let i = 0; i < this.traces.length; i++) {
      const traceA = this.traces[i]!
      for (let j = i + 1; j < this.traces.length; j++) {
        const traceB = this.traces[j]!
        if (traceA.globalConnNetId !== traceB.globalConnNetId) continue

        for (let aIdx = 0; aIdx < traceA.tracePath.length - 1; aIdx++) {
          const segmentA = getSegment(traceA, i, aIdx)
          if (!segmentA) continue

          for (let bIdx = 0; bIdx < traceB.tracePath.length - 1; bIdx++) {
            const segmentB = getSegment(traceB, j, bIdx)
            if (!segmentB) continue

            if (this.tryMergeSegments(segmentA, segmentB)) {
              return true
            }
          }
        }
      }
    }
    return false
  }

  private tryMergeSegments(segmentA: SegmentRef, segmentB: SegmentRef) {
    if (segmentA.orientation !== segmentB.orientation) return false

    const axisDistance = Math.abs(segmentA.axis - segmentB.axis)
    if (axisDistance < EPS || axisDistance > this.mergeDistance) return false

    const overlap = getOverlap(segmentA, segmentB)
    const shorterLength = Math.min(segmentA.length, segmentB.length)
    if (overlap < this.minOverlap) return false
    if (overlap < shorterLength * this.minOverlapRatio) return false

    const segmentToMove = this.getMovableSegment(segmentA, segmentB)
    const targetSegment = segmentToMove === segmentA ? segmentB : segmentA

    if (!segmentToMove) return false

    const trace = this.traces[segmentToMove.traceIndex]!
    const start = trace.tracePath[segmentToMove.segmentIndex]!
    const end = trace.tracePath[segmentToMove.segmentIndex + 1]!

    if (segmentToMove.orientation === "horizontal") {
      start.y = targetSegment.axis
      end.y = targetSegment.axis
    } else {
      start.x = targetSegment.axis
      end.x = targetSegment.axis
    }

    trace.tracePath = simplifyPath(trace.tracePath)
    return true
  }

  private getMovableSegment(segmentA: SegmentRef, segmentB: SegmentRef) {
    if (segmentA.movable && !segmentB.movable) return segmentA
    if (segmentB.movable && !segmentA.movable) return segmentB
    if (!segmentA.movable && !segmentB.movable) return null
    return segmentA.length <= segmentB.length ? segmentA : segmentB
  }

  getOutput() {
    return {
      traces: this.traces,
    }
  }
}
