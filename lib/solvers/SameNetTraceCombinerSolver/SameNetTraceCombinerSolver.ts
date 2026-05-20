import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import type { Point } from "@tscircuit/math-utils"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"

type Axis = "horizontal" | "vertical"

interface SameNetTraceCombinerInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  proximityThreshold?: number
}

interface SegmentLocator {
  traceIndex: number
  segmentIndex: number
  axis: Axis
  fixedCoord: number
  rangeMin: number
  rangeMax: number
  length: number
  movable: boolean
}

interface RectBounds {
  chipId: string
  minX: number
  maxX: number
  minY: number
  maxY: number
}

const EPS = 1e-6
const DEFAULT_PROXIMITY_THRESHOLD = 0.12

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  pins: [...trace.pins] as SolvedTracePath["pins"],
  tracePath: trace.tracePath.map((p) => ({ ...p })),
  mspConnectionPairIds: [...trace.mspConnectionPairIds],
  pinIds: [...trace.pinIds],
})

const getAxis = (a: Point, b: Point): Axis | null => {
  if (Math.abs(a.y - b.y) < EPS) return "horizontal"
  if (Math.abs(a.x - b.x) < EPS) return "vertical"
  return null
}

const getProjectionGap = (a: SegmentLocator, b: SegmentLocator): number => {
  return Math.max(
    0,
    Math.max(a.rangeMin, b.rangeMin) - Math.min(a.rangeMax, b.rangeMax),
  )
}

const getSegments = (traces: SolvedTracePath[]): SegmentLocator[] => {
  const segments: SegmentLocator[] = []

  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const path = traces[traceIndex]!.tracePath
    for (let segmentIndex = 0; segmentIndex < path.length - 1; segmentIndex++) {
      const p1 = path[segmentIndex]!
      const p2 = path[segmentIndex + 1]!
      const axis = getAxis(p1, p2)
      if (!axis) continue

      const rangeValues = axis === "horizontal" ? [p1.x, p2.x] : [p1.y, p2.y]
      const fixedCoord = axis === "horizontal" ? p1.y : p1.x
      const rangeMin = Math.min(...rangeValues)
      const rangeMax = Math.max(...rangeValues)

      segments.push({
        traceIndex,
        segmentIndex,
        axis,
        fixedCoord,
        rangeMin,
        rangeMax,
        length: rangeMax - rangeMin,
        movable: segmentIndex > 0 && segmentIndex < path.length - 2,
      })
    }
  }

  return segments
}

const getTraceObstacleRects = (
  traces: SolvedTracePath[],
  movingSegment: SegmentLocator,
): RectBounds[] => {
  const movingTrace = traces[movingSegment.traceIndex]!
  const TRACE_WIDTH = 0.01

  return traces
    .filter(
      (trace, traceIndex) =>
        traceIndex !== movingSegment.traceIndex &&
        trace.globalConnNetId !== movingTrace.globalConnNetId,
    )
    .flatMap((trace) =>
      trace.tracePath.slice(0, -1).map((p1, pointIndex) => {
        const p2 = trace.tracePath[pointIndex + 1]!
        return {
          chipId: `trace-obstacle-${trace.mspPairId}-${pointIndex}`,
          minX: Math.min(p1.x, p2.x) - TRACE_WIDTH / 2,
          maxX: Math.max(p1.x, p2.x) + TRACE_WIDTH / 2,
          minY: Math.min(p1.y, p2.y) - TRACE_WIDTH / 2,
          maxY: Math.max(p1.y, p2.y) + TRACE_WIDTH / 2,
        }
      }),
    )
}

const segmentIntersectsAnyRect = (
  p1: Point,
  p2: Point,
  rects: RectBounds[],
): boolean => rects.some((rect) => segmentIntersectsRect(p1, p2, rect))

const simplifyTracePath = (path: Point[]): Point[] => {
  const withoutDuplicates: Point[] = []
  for (const point of path) {
    const previous = withoutDuplicates.at(-1)
    if (
      !previous ||
      Math.abs(previous.x - point.x) > EPS ||
      Math.abs(previous.y - point.y) > EPS
    ) {
      withoutDuplicates.push({ ...point })
    }
  }

  const simplified: Point[] = []
  for (const point of withoutDuplicates) {
    simplified.push(point)
    while (simplified.length >= 3) {
      const a = simplified[simplified.length - 3]!
      const b = simplified[simplified.length - 2]!
      const c = simplified[simplified.length - 1]!
      const collinearHorizontal =
        Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS
      const collinearVertical =
        Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS
      if (!collinearHorizontal && !collinearVertical) break
      simplified.splice(simplified.length - 2, 1)
    }
  }

  return simplified
}

export class SameNetTraceCombinerSolver extends BaseSolver {
  private input: SameNetTraceCombinerInput
  private skippedCombinationKeys = new Set<string>()
  public outputTraces: SolvedTracePath[]
  public lastCombinedSegments: [SegmentLocator, SegmentLocator] | null = null

  constructor(input: SameNetTraceCombinerInput) {
    super()
    this.input = input
    this.outputTraces = input.traces.map(cloneTrace)
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceCombinerSolver
  >[0] {
    return this.input
  }

  private getCombinationKey(a: SegmentLocator, b: SegmentLocator): string {
    return [
      `${a.traceIndex}:${a.segmentIndex}`,
      `${b.traceIndex}:${b.segmentIndex}`,
    ]
      .sort()
      .join("|")
  }

  private findNextCombination(): [SegmentLocator, SegmentLocator] | null {
    const proximityThreshold =
      this.input.proximityThreshold ?? DEFAULT_PROXIMITY_THRESHOLD
    const segments = getSegments(this.outputTraces)

    for (let aIndex = 0; aIndex < segments.length; aIndex++) {
      const a = segments[aIndex]!
      const traceA = this.outputTraces[a.traceIndex]!

      for (let bIndex = aIndex + 1; bIndex < segments.length; bIndex++) {
        const b = segments[bIndex]!
        const traceB = this.outputTraces[b.traceIndex]!

        if (traceA.globalConnNetId !== traceB.globalConnNetId) continue
        if (a.traceIndex === b.traceIndex) continue
        if (a.axis !== b.axis) continue
        if (!a.movable && !b.movable) continue
        if (this.skippedCombinationKeys.has(this.getCombinationKey(a, b))) {
          continue
        }

        const distance = Math.abs(a.fixedCoord - b.fixedCoord)
        if (distance < EPS || distance > proximityThreshold) continue
        if (getProjectionGap(a, b) > proximityThreshold) continue

        if (a.movable && !b.movable) return [a, b]
        if (!a.movable && b.movable) return [b, a]
        return b.length <= a.length ? [b, a] : [a, b]
      }
    }

    return null
  }

  private getSnappedPath(segment: SegmentLocator, fixedCoord: number): Point[] {
    const path = this.outputTraces[segment.traceIndex]!.tracePath.map((p) => ({
      ...p,
    }))
    const p1 = path[segment.segmentIndex]!
    const p2 = path[segment.segmentIndex + 1]!

    if (segment.axis === "horizontal") {
      p1.y = fixedCoord
      p2.y = fixedCoord
    } else {
      p1.x = fixedCoord
      p2.x = fixedCoord
    }

    return simplifyTracePath(path)
  }

  private wouldSnapIntroduceCollision(
    segment: SegmentLocator,
    snappedPath: Point[],
  ): boolean {
    const TOLERANCE = 1e-5
    const staticObstacles = getObstacleRects(this.input.inputProblem).map(
      (obs) => ({
        chipId: obs.chipId,
        minX: obs.minX + TOLERANCE,
        maxX: obs.maxX - TOLERANCE,
        minY: obs.minY + TOLERANCE,
        maxY: obs.maxY - TOLERANCE,
      }),
    )
    const otherNetTraceObstacles = getTraceObstacleRects(
      this.outputTraces,
      segment,
    )
    const collisionObstacles = [...staticObstacles, ...otherNetTraceObstacles]

    for (let i = 0; i < snappedPath.length - 1; i++) {
      if (
        segmentIntersectsAnyRect(
          snappedPath[i]!,
          snappedPath[i + 1]!,
          collisionObstacles,
        )
      ) {
        return true
      }
    }

    return false
  }

  private snapSegmentToFixedCoord(segment: SegmentLocator, fixedCoord: number) {
    const snappedPath = this.getSnappedPath(segment, fixedCoord)
    if (this.wouldSnapIntroduceCollision(segment, snappedPath)) {
      return false
    }

    this.outputTraces[segment.traceIndex] = {
      ...this.outputTraces[segment.traceIndex]!,
      tracePath: snappedPath,
    }
    return true
  }

  override _step() {
    const combination = this.findNextCombination()
    if (!combination) {
      this.solved = true
      return
    }

    const [movingSegment, targetSegment] = combination
    const didSnap = this.snapSegmentToFixedCoord(
      movingSegment,
      targetSegment.fixedCoord,
    )
    if (!didSnap) {
      this.skippedCombinationKeys.add(
        this.getCombinationKey(movingSegment, targetSegment),
      )
      return
    }
    this.lastCombinedSegments = combination
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

    for (const trace of this.outputTraces) {
      const line: Line = {
        points: trace.tracePath,
        strokeColor: "blue",
      }
      graphics.lines!.push(line)
    }

    return graphics
  }
}
