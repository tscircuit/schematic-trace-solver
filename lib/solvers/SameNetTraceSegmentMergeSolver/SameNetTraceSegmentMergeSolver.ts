import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
  segmentIntersectsRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { isSegmentAnEndpointSegment } from "lib/solvers/TraceCleanupSolver/isSegmentAnEndpointSegment"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"

const EPS = 1e-9

type Orientation = "horizontal" | "vertical"

type TraceSegment = {
  traceIndex: number
  segmentIndex: number
  p1: Point
  p2: Point
  orientation: Orientation
}

export type SameNetTraceSegmentMergeSolverParams = {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  mergeDistance?: number
  minOverlap?: number
}

export class SameNetTraceSegmentMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  mergeDistance: number
  minOverlap: number
  mergedSegmentCount = 0

  constructor(params: SameNetTraceSegmentMergeSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.traces
    this.outputTraces = cloneTraces(params.traces)
    this.mergeDistance = params.mergeDistance ?? 0.15
    this.minOverlap = params.minOverlap ?? 0.02
  }

  override getConstructorParams(): SameNetTraceSegmentMergeSolverParams {
    return {
      inputProblem: this.inputProblem,
      traces: this.inputTraces,
      mergeDistance: this.mergeDistance,
      minOverlap: this.minOverlap,
    }
  }

  override _step() {
    let changed = true
    const maxPasses = Math.max(1, this.outputTraces.length * 4)

    for (let pass = 0; changed && pass < maxPasses; pass++) {
      changed = false
      const segmentsByNet = this.getSegmentsByNet()

      for (const segments of segmentsByNet.values()) {
        if (this.alignFirstMergeablePair(segments)) {
          changed = true
          this.mergedSegmentCount++
          break
        }
      }
    }

    this.stats.mergedSegmentCount = this.mergedSegmentCount
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      mergedSegmentCount: this.mergedSegmentCount,
    }
  }

  private getSegmentsByNet(): Map<string, TraceSegment[]> {
    const segmentsByNet = new Map<string, TraceSegment[]>()

    for (
      let traceIndex = 0;
      traceIndex < this.outputTraces.length;
      traceIndex++
    ) {
      const trace = this.outputTraces[traceIndex]!
      const netId = getTraceNetId(trace)
      if (!netId) continue

      for (
        let segmentIndex = 0;
        segmentIndex < trace.tracePath.length - 1;
        segmentIndex++
      ) {
        const p1 = trace.tracePath[segmentIndex]!
        const p2 = trace.tracePath[segmentIndex + 1]!
        const orientation = getOrientation(p1, p2)
        if (!orientation) continue

        const netSegments = segmentsByNet.get(netId) ?? []
        netSegments.push({ traceIndex, segmentIndex, p1, p2, orientation })
        segmentsByNet.set(netId, netSegments)
      }
    }

    return segmentsByNet
  }

  private alignFirstMergeablePair(segments: TraceSegment[]): boolean {
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i]!
        const b = segments[j]!

        if (a.traceIndex === b.traceIndex || a.orientation !== b.orientation) {
          continue
        }
        if (!this.areCloseAndOverlapping(a, b)) continue

        const movingSegment = this.chooseMovableSegment(a, b)
        if (!movingSegment) continue
        const targetSegment = movingSegment === a ? b : a
        if (this.alignSegmentToTarget(movingSegment, targetSegment)) {
          return true
        }
      }
    }

    return false
  }

  private areCloseAndOverlapping(a: TraceSegment, b: TraceSegment): boolean {
    const perpendicularDistance =
      a.orientation === "horizontal"
        ? Math.abs(a.p1.y - b.p1.y)
        : Math.abs(a.p1.x - b.p1.x)

    if (
      perpendicularDistance <= EPS ||
      perpendicularDistance > this.mergeDistance
    ) {
      return false
    }

    const overlap =
      a.orientation === "horizontal"
        ? overlapLength(a.p1.x, a.p2.x, b.p1.x, b.p2.x)
        : overlapLength(a.p1.y, a.p2.y, b.p1.y, b.p2.y)

    return overlap >= this.minOverlap
  }

  private chooseMovableSegment(
    a: TraceSegment,
    b: TraceSegment,
  ): TraceSegment | null {
    const aMovable = this.canMoveSegment(a)
    const bMovable = this.canMoveSegment(b)
    if (!aMovable && !bMovable) return null
    if (aMovable && !bMovable) return a
    if (bMovable && !aMovable) return b

    return segmentLength(a) <= segmentLength(b) ? a : b
  }

  private canMoveSegment(segment: TraceSegment): boolean {
    const trace = this.outputTraces[segment.traceIndex]!
    return !isSegmentAnEndpointSegment(segment.p1, segment.p2, trace.tracePath)
  }

  private alignSegmentToTarget(
    segment: TraceSegment,
    target: TraceSegment,
  ): boolean {
    const trace = this.outputTraces[segment.traceIndex]!
    const nextPath = trace.tracePath.map((point) => ({ ...point }))
    const p1 = nextPath[segment.segmentIndex]!
    const p2 = nextPath[segment.segmentIndex + 1]!

    if (segment.orientation === "horizontal") {
      p1.y = target.p1.y
      p2.y = target.p1.y
    } else {
      p1.x = target.p1.x
      p2.x = target.p1.x
    }

    if (
      this.changedSegmentsHitChipObstacle(trace.tracePath, nextPath) ||
      this.changedSegmentsCrossDifferentNet(segment.traceIndex, nextPath)
    ) {
      return false
    }

    this.outputTraces[segment.traceIndex] = {
      ...trace,
      tracePath: simplifyPath(nextPath),
    }

    return true
  }

  private changedSegmentsHitChipObstacle(
    originalPath: Point[],
    nextPath: Point[],
  ): boolean {
    const obstacles = getObstacleRects(this.inputProblem)
    for (let i = 0; i < nextPath.length - 1; i++) {
      if (
        pointsEqual(originalPath[i]!, nextPath[i]!) &&
        pointsEqual(originalPath[i + 1]!, nextPath[i + 1]!)
      ) {
        continue
      }
      if (i === 0 || i === nextPath.length - 2) continue

      for (const obstacle of obstacles) {
        if (segmentIntersectsRect(nextPath[i]!, nextPath[i + 1]!, obstacle)) {
          return true
        }
      }
    }

    return false
  }

  private changedSegmentsCrossDifferentNet(
    traceIndex: number,
    nextPath: Point[],
  ): boolean {
    const movingTrace = this.outputTraces[traceIndex]!
    for (let i = 0; i < nextPath.length - 1; i++) {
      const a = nextPath[i]!
      const b = nextPath[i + 1]!
      const originalA = movingTrace.tracePath[i]!
      const originalB = movingTrace.tracePath[i + 1]!
      if (pointsEqual(a, originalA) && pointsEqual(b, originalB)) continue

      for (
        let otherTraceIndex = 0;
        otherTraceIndex < this.outputTraces.length;
        otherTraceIndex++
      ) {
        if (otherTraceIndex === traceIndex) continue
        const otherTrace = this.outputTraces[otherTraceIndex]!
        if (getTraceNetId(otherTrace) === getTraceNetId(movingTrace)) continue

        for (let j = 0; j < otherTrace.tracePath.length - 1; j++) {
          if (
            segmentsIntersect(
              a,
              b,
              otherTrace.tracePath[j]!,
              otherTrace.tracePath[j + 1]!,
            )
          ) {
            return true
          }
        }
      }
    }

    return false
  }

  override visualize(): GraphicsObject {
    return {
      lines: this.outputTraces.map((trace) => ({
        points: trace.tracePath,
        strokeColor: "blue",
      })),
      points: [],
      rects: [],
      circles: [],
    }
  }
}

function cloneTraces(traces: SolvedTracePath[]): SolvedTracePath[] {
  return traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
    mspConnectionPairIds: [...trace.mspConnectionPairIds],
    pinIds: [...trace.pinIds],
  }))
}

function getTraceNetId(trace: SolvedTracePath): string {
  return trace.globalConnNetId ?? trace.userNetId ?? trace.dcConnNetId
}

function getOrientation(a: Point, b: Point): Orientation | null {
  if (isHorizontal(a, b)) return "horizontal"
  if (isVertical(a, b)) return "vertical"
  return null
}

function overlapLength(a1: number, a2: number, b1: number, b2: number): number {
  return (
    Math.min(Math.max(a1, a2), Math.max(b1, b2)) -
    Math.max(Math.min(a1, a2), Math.min(b1, b2))
  )
}

function segmentLength(segment: TraceSegment): number {
  return segment.orientation === "horizontal"
    ? Math.abs(segment.p1.x - segment.p2.x)
    : Math.abs(segment.p1.y - segment.p2.y)
}

function pointsEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS
}

function segmentsIntersect(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): boolean {
  const aOrientation = getOrientation(a1, a2)
  const bOrientation = getOrientation(b1, b2)
  if (!aOrientation || !bOrientation) return false

  if (aOrientation !== bOrientation) {
    const horizontal = aOrientation === "horizontal" ? [a1, a2] : [b1, b2]
    const vertical = aOrientation === "vertical" ? [a1, a2] : [b1, b2]
    const [h1, h2] = horizontal
    const [v1, v2] = vertical
    return between(v1!.x, h1!.x, h2!.x) && between(h1!.y, v1!.y, v2!.y)
  }

  if (aOrientation === "horizontal" && Math.abs(a1.y - b1.y) <= EPS) {
    return overlapLength(a1.x, a2.x, b1.x, b2.x) > EPS
  }

  if (aOrientation === "vertical" && Math.abs(a1.x - b1.x) <= EPS) {
    return overlapLength(a1.y, a2.y, b1.y, b2.y) > EPS
  }

  return false
}

function between(value: number, a: number, b: number): boolean {
  return value >= Math.min(a, b) - EPS && value <= Math.max(a, b) + EPS
}
