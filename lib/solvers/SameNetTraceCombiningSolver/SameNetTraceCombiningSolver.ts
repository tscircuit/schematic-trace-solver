import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { GraphicsObject, Line } from "graphics-debug"
import type { Point } from "@tscircuit/math-utils"

type Orientation = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  segmentIndex: number
  trace: SolvedTracePath
  orientation: Orientation
  p0: Point
  p1: Point
  constCoord: number
  min: number
  max: number
}

interface SameNetTraceCombiningSolverInput {
  traces: SolvedTracePath[]
  mergeDistance?: number
  minOverlap?: number
}

const EPSILON = 1e-9

export class SameNetTraceCombiningSolver extends BaseSolver {
  private input: Required<SameNetTraceCombiningSolverInput>
  outputTraces: SolvedTracePath[]
  movedSegments: Array<{
    mspPairId: string
    segmentIndex: number
    from: number
    to: number
    orientation: Orientation
  }> = []

  constructor(input: SameNetTraceCombiningSolverInput) {
    super()
    this.input = {
      traces: input.traces,
      mergeDistance: input.mergeDistance ?? 0.15,
      minOverlap: input.minOverlap ?? 0.05,
    }
    this.outputTraces = input.traces.map((trace) => ({
      ...trace,
      tracePath: trace.tracePath.map((p) => ({ ...p })),
    }))
  }

  override _step() {
    this.combineCloseSameNetSegments()
    this.solved = true
  }

  private combineCloseSameNetSegments() {
    let changed = true
    let passCount = 0

    while (changed && passCount < 10) {
      changed = false
      passCount++

      const segments = this.getSegments()

      for (let i = 0; i < segments.length; i++) {
        const a = segments[i]!
        for (let j = i + 1; j < segments.length; j++) {
          const b = segments[j]!
          if (!this.canCombine(a, b)) continue

          const firstChoice =
            this.segmentLength(a) <= this.segmentLength(b)
              ? { moving: a, target: b }
              : { moving: b, target: a }
          const secondChoice =
            firstChoice.moving === a
              ? { moving: b, target: a }
              : { moving: a, target: b }

          if (this.trySnapSegment(firstChoice.moving, firstChoice.target)) {
            changed = true
            break
          }

          if (this.trySnapSegment(secondChoice.moving, secondChoice.target)) {
            changed = true
            break
          }
        }
        if (changed) break
      }
    }
  }

  private getSegments(): SegmentRef[] {
    const segments: SegmentRef[] = []
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
        const p0 = trace.tracePath[segmentIndex]!
        const p1 = trace.tracePath[segmentIndex + 1]!
        if (Math.abs(p0.y - p1.y) < EPSILON) {
          segments.push({
            traceIndex,
            segmentIndex,
            trace,
            orientation: "horizontal",
            p0,
            p1,
            constCoord: p0.y,
            min: Math.min(p0.x, p1.x),
            max: Math.max(p0.x, p1.x),
          })
        } else if (Math.abs(p0.x - p1.x) < EPSILON) {
          segments.push({
            traceIndex,
            segmentIndex,
            trace,
            orientation: "vertical",
            p0,
            p1,
            constCoord: p0.x,
            min: Math.min(p0.y, p1.y),
            max: Math.max(p0.y, p1.y),
          })
        }
      }
    }
    return segments
  }

  private canCombine(a: SegmentRef, b: SegmentRef): boolean {
    if (a.trace.mspPairId === b.trace.mspPairId) return false
    if (a.trace.globalConnNetId !== b.trace.globalConnNetId) return false
    if (a.orientation !== b.orientation) return false
    if (Math.abs(a.constCoord - b.constCoord) > this.input.mergeDistance) {
      return false
    }
    return this.overlapLength(a, b) >= this.input.minOverlap
  }

  private trySnapSegment(moving: SegmentRef, target: SegmentRef): boolean {
    if (!this.isInternalSegment(moving)) return false
    if (Math.abs(moving.constCoord - target.constCoord) < EPSILON) return false

    const candidate = this.outputTraces.map((trace) => ({
      ...trace,
      tracePath: trace.tracePath.map((p) => ({ ...p })),
    }))

    const candidateTrace = candidate[moving.traceIndex]!
    const p0 = candidateTrace.tracePath[moving.segmentIndex]!
    const p1 = candidateTrace.tracePath[moving.segmentIndex + 1]!

    if (moving.orientation === "horizontal") {
      p0.y = target.constCoord
      p1.y = target.constCoord
    } else {
      p0.x = target.constCoord
      p1.x = target.constCoord
    }

    if (this.hasDifferentNetIntersection(candidate, moving.traceIndex)) {
      return false
    }

    this.outputTraces = candidate
    this.movedSegments.push({
      mspPairId: moving.trace.mspPairId,
      segmentIndex: moving.segmentIndex,
      from: moving.constCoord,
      to: target.constCoord,
      orientation: moving.orientation,
    })
    return true
  }

  private isInternalSegment(segment: SegmentRef): boolean {
    return (
      segment.segmentIndex > 0 &&
      segment.segmentIndex < segment.trace.tracePath.length - 2
    )
  }

  private hasDifferentNetIntersection(
    candidate: SolvedTracePath[],
    movedTraceIndex: number,
  ): boolean {
    const movedTrace = candidate[movedTraceIndex]!
    const movedSegments = this.traceSegments(movedTrace)

    for (let traceIndex = 0; traceIndex < candidate.length; traceIndex++) {
      if (traceIndex === movedTraceIndex) continue
      const otherTrace = candidate[traceIndex]!
      if (otherTrace.globalConnNetId === movedTrace.globalConnNetId) continue

      for (const moved of movedSegments) {
        for (const other of this.traceSegments(otherTrace)) {
          if (segmentsIntersect(moved[0], moved[1], other[0], other[1])) {
            return true
          }
        }
      }
    }

    return false
  }

  private traceSegments(trace: SolvedTracePath): Array<[Point, Point]> {
    const segments: Array<[Point, Point]> = []
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      segments.push([trace.tracePath[i]!, trace.tracePath[i + 1]!])
    }
    return segments
  }

  private overlapLength(a: SegmentRef, b: SegmentRef): number {
    return Math.max(0, Math.min(a.max, b.max) - Math.max(a.min, b.min))
  }

  private segmentLength(segment: SegmentRef): number {
    return segment.max - segment.min
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      movedSegments: this.movedSegments,
    }
  }

  override visualize(): GraphicsObject {
    const lines: Line[] = this.outputTraces.map((trace) => ({
      points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
      strokeColor: "blue",
    }))

    return {
      lines,
      points: [],
      rects: [],
      circles: [],
    }
  }
}

function segmentsIntersect(a0: Point, a1: Point, b0: Point, b1: Point) {
  const aHorizontal = Math.abs(a0.y - a1.y) < EPSILON
  const aVertical = Math.abs(a0.x - a1.x) < EPSILON
  const bHorizontal = Math.abs(b0.y - b1.y) < EPSILON
  const bVertical = Math.abs(b0.x - b1.x) < EPSILON

  if (aHorizontal && bHorizontal) {
    if (Math.abs(a0.y - b0.y) >= EPSILON) return false
    return rangesOverlap(a0.x, a1.x, b0.x, b1.x)
  }

  if (aVertical && bVertical) {
    if (Math.abs(a0.x - b0.x) >= EPSILON) return false
    return rangesOverlap(a0.y, a1.y, b0.y, b1.y)
  }

  const horizontal = aHorizontal ? [a0, a1] : [b0, b1]
  const vertical = aVertical ? [a0, a1] : [b0, b1]
  const hx0 = Math.min(horizontal[0]!.x, horizontal[1]!.x)
  const hx1 = Math.max(horizontal[0]!.x, horizontal[1]!.x)
  const hy = horizontal[0]!.y
  const vx = vertical[0]!.x
  const vy0 = Math.min(vertical[0]!.y, vertical[1]!.y)
  const vy1 = Math.max(vertical[0]!.y, vertical[1]!.y)

  return (
    vx >= hx0 - EPSILON &&
    vx <= hx1 + EPSILON &&
    hy >= vy0 - EPSILON &&
    hy <= vy1 + EPSILON
  )
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number) {
  const minA = Math.min(a0, a1)
  const maxA = Math.max(a0, a1)
  const minB = Math.min(b0, b1)
  const maxB = Math.max(b0, b1)

  return Math.min(maxA, maxB) - Math.max(minA, minB) >= EPSILON
}
