import type { Point } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"

const EPS = 1e-6
const DEFAULT_MAX_COMBINE_DISTANCE = 0.12

type SegmentOrientation = "horizontal" | "vertical"

type SegmentLocator = {
  trace: SolvedTracePath
  segmentIndex: number
  orientation: SegmentOrientation
  coord: number
  min: number
  max: number
  length: number
}

export class SameNetTraceSegmentCombinationSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  maxCombineDistance: number

  constructor(params: {
    inputProblem: InputProblem
    inputTraces: SolvedTracePath[]
    maxCombineDistance?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.inputTraces
    this.outputTraces = params.inputTraces.map((trace) => ({
      ...trace,
      tracePath: trace.tracePath.map((point) => ({ ...point })),
      mspConnectionPairIds: [...trace.mspConnectionPairIds],
      pinIds: [...trace.pinIds],
      pins: [{ ...trace.pins[0] }, { ...trace.pins[1] }],
    }))
    this.maxCombineDistance =
      params.maxCombineDistance ?? DEFAULT_MAX_COMBINE_DISTANCE
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceSegmentCombinationSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTraces: this.inputTraces,
      maxCombineDistance: this.maxCombineDistance,
    }
  }

  override _step() {
    const didCombine = this.combineNextSegment()
    if (!didCombine) {
      this.solved = true
    }
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  private combineNextSegment(): boolean {
    const segments = this.getSegments()

    for (let i = 0; i < segments.length; i++) {
      const a = segments[i]!
      for (let j = i + 1; j < segments.length; j++) {
        const b = segments[j]!
        if (a.trace.mspPairId === b.trace.mspPairId) continue
        if (a.trace.globalConnNetId !== b.trace.globalConnNetId) continue
        if (a.orientation !== b.orientation) continue

        const distance = Math.abs(a.coord - b.coord)
        if (distance <= EPS || distance > this.maxCombineDistance) continue

        const target = this.getContainedCandidate(a, b)
        if (!target) continue

        if (this.tryMoveSegment(target.moving, target.anchor.coord)) {
          return true
        }
      }
    }

    return false
  }

  private getSegments(): SegmentLocator[] {
    const segments: SegmentLocator[] = []

    for (const trace of this.outputTraces) {
      const points = trace.tracePath
      for (
        let segmentIndex = 0;
        segmentIndex < points.length - 1;
        segmentIndex++
      ) {
        const p1 = points[segmentIndex]!
        const p2 = points[segmentIndex + 1]!
        const isHorizontal = Math.abs(p1.y - p2.y) <= EPS
        const isVertical = Math.abs(p1.x - p2.x) <= EPS
        if (!isHorizontal && !isVertical) continue

        if (isHorizontal) {
          const min = Math.min(p1.x, p2.x)
          const max = Math.max(p1.x, p2.x)
          segments.push({
            trace,
            segmentIndex,
            orientation: "horizontal",
            coord: p1.y,
            min,
            max,
            length: max - min,
          })
        } else {
          const min = Math.min(p1.y, p2.y)
          const max = Math.max(p1.y, p2.y)
          segments.push({
            trace,
            segmentIndex,
            orientation: "vertical",
            coord: p1.x,
            min,
            max,
            length: max - min,
          })
        }
      }
    }

    return segments
  }

  private getContainedCandidate(
    a: SegmentLocator,
    b: SegmentLocator,
  ): { moving: SegmentLocator; anchor: SegmentLocator } | null {
    const aInB = a.min >= b.min - EPS && a.max <= b.max + EPS
    const bInA = b.min >= a.min - EPS && b.max <= a.max + EPS

    if (aInB && bInA) {
      return a.length <= b.length
        ? { moving: a, anchor: b }
        : { moving: b, anchor: a }
    }
    if (aInB) return { moving: a, anchor: b }
    if (bInA) return { moving: b, anchor: a }
    return null
  }

  private tryMoveSegment(segment: SegmentLocator, newCoord: number): boolean {
    const trace = segment.trace
    const pointCount = trace.tracePath.length

    if (segment.segmentIndex === 0) return false
    if (segment.segmentIndex + 2 >= pointCount) return false

    const candidatePath = trace.tracePath.map((point) => ({ ...point }))
    const p1 = candidatePath[segment.segmentIndex]!
    const p2 = candidatePath[segment.segmentIndex + 1]!

    if (segment.orientation === "horizontal") {
      p1.y = newCoord
      p2.y = newCoord
    } else {
      p1.x = newCoord
      p2.x = newCoord
    }

    const simplifiedPath = simplifyPath(candidatePath)

    if (!isOrthogonalPath(simplifiedPath)) return false
    if (this.collidesWithDifferentNetTrace(trace, simplifiedPath)) return false

    trace.tracePath = simplifiedPath
    return true
  }

  private collidesWithDifferentNetTrace(
    movingTrace: SolvedTracePath,
    candidatePath: Point[],
  ): boolean {
    for (let i = 0; i < candidatePath.length - 1; i++) {
      const a1 = candidatePath[i]!
      const a2 = candidatePath[i + 1]!

      for (const otherTrace of this.outputTraces) {
        if (otherTrace.mspPairId === movingTrace.mspPairId) continue
        if (otherTrace.globalConnNetId === movingTrace.globalConnNetId) continue

        for (let j = 0; j < otherTrace.tracePath.length - 1; j++) {
          const b1 = otherTrace.tracePath[j]!
          const b2 = otherTrace.tracePath[j + 1]!
          if (getSegmentIntersection(a1, a2, b1, b2)) {
            return true
          }
        }
      }
    }

    return false
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)
    for (const trace of this.outputTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }
    return graphics
  }
}

const isOrthogonalPath = (path: Point[]) => {
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]!
    const p2 = path[i + 1]!
    if (Math.abs(p1.x - p2.x) > EPS && Math.abs(p1.y - p2.y) > EPS) {
      return false
    }
  }
  return true
}

const simplifyPath = (path: Point[]) => {
  const withoutDuplicates: Point[] = []
  for (const point of path) {
    const prev = withoutDuplicates[withoutDuplicates.length - 1]
    if (
      !prev ||
      Math.abs(prev.x - point.x) > EPS ||
      Math.abs(prev.y - point.y) > EPS
    ) {
      withoutDuplicates.push(point)
    }
  }

  const simplified: Point[] = []
  for (const point of withoutDuplicates) {
    simplified.push(point)
    while (simplified.length >= 3) {
      const p1 = simplified[simplified.length - 3]!
      const p2 = simplified[simplified.length - 2]!
      const p3 = simplified[simplified.length - 1]!
      const allHorizontal =
        Math.abs(p1.y - p2.y) <= EPS && Math.abs(p2.y - p3.y) <= EPS
      const allVertical =
        Math.abs(p1.x - p2.x) <= EPS && Math.abs(p2.x - p3.x) <= EPS
      if (!allHorizontal && !allVertical) break
      simplified.splice(simplified.length - 2, 1)
    }
  }

  return simplified
}
