import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
  segmentIntersectsRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import {
  getObstacleRects,
  type ChipWithBounds,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"

const EPS = 1e-9

interface SameNetTraceCombiningSolverInput {
  traces: SolvedTracePath[]
  inputProblem?: InputProblem
  mergeDistance?: number
  minOverlap?: number
}

interface TraceSegment {
  traceIndex: number
  segmentIndex: number
  p1: Point
  p2: Point
  horizontal: boolean
  vertical: boolean
}

export class SameNetTraceCombiningSolver extends BaseSolver {
  private input: SameNetTraceCombiningSolverInput
  private traces: SolvedTracePath[]
  private mergeDistance: number
  private minOverlap: number
  private chipObstacles: ChipWithBounds[]

  constructor(input: SameNetTraceCombiningSolverInput) {
    super()
    this.input = input
    this.traces = input.traces.map((trace) => ({
      ...trace,
      tracePath: trace.tracePath.map((point) => ({ ...point })),
    }))
    this.mergeDistance = input.mergeDistance ?? 0.15
    this.minOverlap = input.minOverlap ?? 0.05
    this.chipObstacles = input.inputProblem
      ? getObstacleRects(input.inputProblem)
      : []
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceCombiningSolver
  >[0] {
    return this.input
  }

  override _step() {
    let changed = true

    for (let pass = 0; changed && pass < this.traces.length * 10; pass++) {
      changed = false

      for (let i = 0; i < this.traces.length; i++) {
        for (let j = i + 1; j < this.traces.length; j++) {
          if (
            this.traces[i]!.globalConnNetId !== this.traces[j]!.globalConnNetId
          )
            continue

          if (this.snapCloseSegments(i, j)) {
            changed = true
          }
        }
      }
    }

    this.solved = true
  }

  private snapCloseSegments(traceIndexA: number, traceIndexB: number): boolean {
    const segmentsA = this.getTraceSegments(traceIndexA)
    const segmentsB = this.getTraceSegments(traceIndexB)

    for (const segmentA of segmentsA) {
      for (const segmentB of segmentsB) {
        if (segmentA.horizontal && segmentB.horizontal) {
          if (!this.shouldSnapHorizontalSegments(segmentA, segmentB)) continue
          if (this.snapSegmentPair(segmentA, segmentB, "horizontal"))
            return true
        }

        if (segmentA.vertical && segmentB.vertical) {
          if (!this.shouldSnapVerticalSegments(segmentA, segmentB)) continue
          if (this.snapSegmentPair(segmentA, segmentB, "vertical")) return true
        }
      }
    }

    return false
  }

  private getTraceSegments(traceIndex: number): TraceSegment[] {
    const tracePath = this.traces[traceIndex]!.tracePath
    const segments: TraceSegment[] = []

    for (
      let segmentIndex = 0;
      segmentIndex < tracePath.length - 1;
      segmentIndex++
    ) {
      const p1 = tracePath[segmentIndex]!
      const p2 = tracePath[segmentIndex + 1]!
      const horizontal = isHorizontal(p1, p2)
      const vertical = isVertical(p1, p2)

      if (!horizontal && !vertical) continue

      segments.push({
        traceIndex,
        segmentIndex,
        p1,
        p2,
        horizontal,
        vertical,
      })
    }

    return segments
  }

  private shouldSnapHorizontalSegments(a: TraceSegment, b: TraceSegment) {
    const distance = Math.abs(a.p1.y - b.p1.y)
    if (distance <= EPS || distance > this.mergeDistance) return false

    return this.overlapLength(a.p1.x, a.p2.x, b.p1.x, b.p2.x) >= this.minOverlap
  }

  private shouldSnapVerticalSegments(a: TraceSegment, b: TraceSegment) {
    const distance = Math.abs(a.p1.x - b.p1.x)
    if (distance <= EPS || distance > this.mergeDistance) return false

    return this.overlapLength(a.p1.y, a.p2.y, b.p1.y, b.p2.y) >= this.minOverlap
  }

  private overlapLength(a1: number, a2: number, b1: number, b2: number) {
    return (
      Math.min(Math.max(a1, a2), Math.max(b1, b2)) -
      Math.max(Math.min(a1, a2), Math.min(b1, b2))
    )
  }

  private snapSegmentPair(
    segmentA: TraceSegment,
    segmentB: TraceSegment,
    orientation: "horizontal" | "vertical",
  ) {
    const canMoveA = this.canMoveSegment(segmentA)
    const canMoveB = this.canMoveSegment(segmentB)
    if (!canMoveA && !canMoveB) return false

    const lengthA = this.segmentLength(segmentA)
    const lengthB = this.segmentLength(segmentB)
    const movingSegment =
      canMoveA && (!canMoveB || lengthA < lengthB) ? segmentA : segmentB
    const targetSegment = movingSegment === segmentA ? segmentB : segmentA

    const nextTrace = this.traces[movingSegment.traceIndex]!
    const nextPath = nextTrace.tracePath.map((point) => ({ ...point }))
    const firstPoint = nextPath[movingSegment.segmentIndex]!
    const secondPoint = nextPath[movingSegment.segmentIndex + 1]!

    if (orientation === "horizontal") {
      firstPoint.y = targetSegment.p1.y
      secondPoint.y = targetSegment.p1.y
    } else {
      firstPoint.x = targetSegment.p1.x
      secondPoint.x = targetSegment.p1.x
    }

    if (
      this.crossesDifferentNetTrace(
        movingSegment.traceIndex,
        nextPath,
        movingSegment.segmentIndex,
      )
    ) {
      return false
    }

    if (this.crossesChipObstacle(nextPath, movingSegment.segmentIndex)) {
      return false
    }

    this.traces[movingSegment.traceIndex] = {
      ...nextTrace,
      tracePath: simplifyPath(nextPath),
    }
    return true
  }

  private canMoveSegment(segment: TraceSegment) {
    const tracePath = this.traces[segment.traceIndex]!.tracePath
    return (
      segment.segmentIndex > 0 && segment.segmentIndex < tracePath.length - 2
    )
  }

  private segmentLength(segment: TraceSegment) {
    return Math.abs(
      segment.horizontal
        ? segment.p2.x - segment.p1.x
        : segment.p2.y - segment.p1.y,
    )
  }

  private crossesDifferentNetTrace(
    traceIndex: number,
    nextPath: Point[],
    movedSegmentIndex: number,
  ) {
    const trace = this.traces[traceIndex]!
    const firstChangedSegment = Math.max(0, movedSegmentIndex - 1)
    const lastChangedSegment = Math.min(
      nextPath.length - 2,
      movedSegmentIndex + 1,
    )

    for (let i = firstChangedSegment; i <= lastChangedSegment; i++) {
      const a1 = nextPath[i]!
      const a2 = nextPath[i + 1]!
      if (!isHorizontal(a1, a2) && !isVertical(a1, a2)) continue

      for (let otherIndex = 0; otherIndex < this.traces.length; otherIndex++) {
        const otherTrace = this.traces[otherIndex]!
        if (otherIndex === traceIndex) continue
        if (otherTrace.globalConnNetId === trace.globalConnNetId) continue

        for (let j = 0; j < otherTrace.tracePath.length - 1; j++) {
          const b1 = otherTrace.tracePath[j]!
          const b2 = otherTrace.tracePath[j + 1]!
          if (this.segmentsIntersect(a1, a2, b1, b2)) return true
        }
      }
    }

    return false
  }

  private crossesChipObstacle(nextPath: Point[], movedSegmentIndex: number) {
    const firstChangedSegment = Math.max(0, movedSegmentIndex - 1)
    const lastChangedSegment = Math.min(
      nextPath.length - 2,
      movedSegmentIndex + 1,
    )

    for (let i = firstChangedSegment; i <= lastChangedSegment; i++) {
      const p1 = nextPath[i]!
      const p2 = nextPath[i + 1]!
      if (!isHorizontal(p1, p2) && !isVertical(p1, p2)) continue

      for (const obstacle of this.chipObstacles) {
        if (segmentIntersectsRect(p1, p2, obstacle)) return true
      }
    }

    return false
  }

  private segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point) {
    const aHorizontal = isHorizontal(a1, a2)
    const aVertical = isVertical(a1, a2)
    const bHorizontal = isHorizontal(b1, b2)
    const bVertical = isVertical(b1, b2)

    if (aHorizontal && bHorizontal) {
      return (
        Math.abs(a1.y - b1.y) <= EPS &&
        this.overlapLength(a1.x, a2.x, b1.x, b2.x) > EPS
      )
    }

    if (aVertical && bVertical) {
      return (
        Math.abs(a1.x - b1.x) <= EPS &&
        this.overlapLength(a1.y, a2.y, b1.y, b2.y) > EPS
      )
    }

    if (aHorizontal && bVertical) {
      return (
        this.valueBetween(b1.x, a1.x, a2.x) &&
        this.valueBetween(a1.y, b1.y, b2.y)
      )
    }

    if (aVertical && bHorizontal) {
      return (
        this.valueBetween(a1.x, b1.x, b2.x) &&
        this.valueBetween(b1.y, a1.y, a2.y)
      )
    }

    return false
  }

  private valueBetween(value: number, rangeStart: number, rangeEnd: number) {
    return (
      value >= Math.min(rangeStart, rangeEnd) - EPS &&
      value <= Math.max(rangeStart, rangeEnd) + EPS
    )
  }

  getOutput() {
    return {
      traces: this.traces,
    }
  }

  override visualize(): GraphicsObject {
    return {
      lines: this.traces.map((trace) => ({
        points: trace.tracePath,
        strokeColor: "blue",
        label: trace.globalConnNetId,
      })),
      points: [],
      rects: [],
      circles: [],
    }
  }
}
