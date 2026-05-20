import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"

const EPS = 1e-6
const DEFAULT_MAX_SEGMENT_DISTANCE = 0.1

type TraceSegmentMergeSolverParams = {
  inputProblem: InputProblem
  inputTracePaths: SolvedTracePath[]
  maxSegmentDistance?: number
}

type SegmentOrientation = "horizontal" | "vertical"

type SegmentLocator = {
  traceIndex: number
  segmentIndex: number
  orientation: SegmentOrientation
  p1: Point
  p2: Point
  constantCoord: number
  rangeStart: number
  rangeEnd: number
  length: number
  movable: boolean
}

export class TraceSegmentMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: SolvedTracePath[]
  outputTracePaths: SolvedTracePath[]
  maxSegmentDistance: number
  mergeCount = 0

  constructor(params: TraceSegmentMergeSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.inputTracePaths
    this.outputTracePaths = structuredClone(params.inputTracePaths)
    this.maxSegmentDistance =
      params.maxSegmentDistance ?? DEFAULT_MAX_SEGMENT_DISTANCE
  }

  override getConstructorParams(): ConstructorParameters<
    typeof TraceSegmentMergeSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTracePaths: this.inputTracePaths,
      maxSegmentDistance: this.maxSegmentDistance,
    }
  }

  override _step() {
    const merged = this.mergeNextCloseSameNetSegment()
    if (!merged) {
      this.solved = true
    }
  }

  private mergeNextCloseSameNetSegment(): boolean {
    for (let i = 0; i < this.outputTracePaths.length; i++) {
      const traceA = this.outputTracePaths[i]!
      for (let j = i + 1; j < this.outputTracePaths.length; j++) {
        const traceB = this.outputTracePaths[j]!
        if (traceA.globalConnNetId !== traceB.globalConnNetId) continue

        const segmentsA = this.getSegmentsForTrace(i)
        const segmentsB = this.getSegmentsForTrace(j)

        for (const segmentA of segmentsA) {
          for (const segmentB of segmentsB) {
            if (segmentA.orientation !== segmentB.orientation) continue
            if (!this.areSegmentsCloseEnough(segmentA, segmentB)) continue
            if (this.mergeSegmentPair(segmentA, segmentB)) {
              this.mergeCount++
              return true
            }
          }
        }
      }
    }

    return false
  }

  private getSegmentsForTrace(traceIndex: number): SegmentLocator[] {
    const trace = this.outputTracePaths[traceIndex]!
    const segments: SegmentLocator[] = []
    for (
      let segmentIndex = 0;
      segmentIndex < trace.tracePath.length - 1;
      segmentIndex++
    ) {
      const p1 = trace.tracePath[segmentIndex]!
      const p2 = trace.tracePath[segmentIndex + 1]!
      const isHorizontal = Math.abs(p1.y - p2.y) < EPS
      const isVertical = Math.abs(p1.x - p2.x) < EPS
      if (!isHorizontal && !isVertical) continue

      const orientation = isHorizontal ? "horizontal" : "vertical"
      const start = isHorizontal ? p1.x : p1.y
      const end = isHorizontal ? p2.x : p2.y

      segments.push({
        traceIndex,
        segmentIndex,
        orientation,
        p1,
        p2,
        constantCoord: isHorizontal ? p1.y : p1.x,
        rangeStart: Math.min(start, end),
        rangeEnd: Math.max(start, end),
        length: Math.abs(end - start),
        movable:
          segmentIndex > 0 && segmentIndex + 1 < trace.tracePath.length - 1,
      })
    }
    return segments
  }

  private areSegmentsCloseEnough(
    segmentA: SegmentLocator,
    segmentB: SegmentLocator,
  ): boolean {
    const perpendicularDistance = Math.abs(
      segmentA.constantCoord - segmentB.constantCoord,
    )
    if (perpendicularDistance > this.maxSegmentDistance) return false

    const gap = Math.max(
      0,
      Math.max(segmentA.rangeStart, segmentB.rangeStart) -
        Math.min(segmentA.rangeEnd, segmentB.rangeEnd),
    )
    return gap <= this.maxSegmentDistance
  }

  private mergeSegmentPair(
    segmentA: SegmentLocator,
    segmentB: SegmentLocator,
  ): boolean {
    const [anchor, target] = this.pickAnchorAndTarget(segmentA, segmentB)
    if (!target) return false

    const nextTrace = structuredClone(this.outputTracePaths[target.traceIndex]!)
    const nextPath = nextTrace.tracePath
    this.alignTargetSegment(nextPath, target, anchor)
    nextTrace.tracePath = simplifyPath(nextPath)

    if (
      !this.didPathChange(
        this.outputTracePaths[target.traceIndex]!.tracePath,
        nextTrace.tracePath,
      )
    ) {
      return false
    }
    if (this.pathTouchesChipObstacle(nextTrace.tracePath)) return false
    if (!this.isPathOrthogonal(nextTrace.tracePath)) return false
    if (
      this.pathCreatesNewCrossNetOverlap(
        this.outputTracePaths[target.traceIndex]!.tracePath,
        nextTrace.tracePath,
        target.traceIndex,
      )
    ) {
      return false
    }

    this.outputTracePaths[target.traceIndex] = nextTrace
    return true
  }

  private didPathChange(previousPath: Point[], nextPath: Point[]): boolean {
    if (previousPath.length !== nextPath.length) return true
    for (let i = 0; i < previousPath.length; i++) {
      const previousPoint = previousPath[i]!
      const nextPoint = nextPath[i]!
      if (
        Math.abs(previousPoint.x - nextPoint.x) > EPS ||
        Math.abs(previousPoint.y - nextPoint.y) > EPS
      ) {
        return true
      }
    }
    return false
  }

  private pickAnchorAndTarget(
    segmentA: SegmentLocator,
    segmentB: SegmentLocator,
  ): [SegmentLocator, SegmentLocator | null] {
    if (!segmentA.movable && !segmentB.movable) return [segmentA, null]
    if (!segmentA.movable) return [segmentA, segmentB]
    if (!segmentB.movable) return [segmentB, segmentA]
    if (segmentA.length >= segmentB.length) return [segmentA, segmentB]
    return [segmentB, segmentA]
  }

  private alignTargetSegment(
    path: Point[],
    target: SegmentLocator,
    anchor: SegmentLocator,
  ) {
    const targetStartPoint = path[target.segmentIndex]!
    const targetEndPoint = path[target.segmentIndex + 1]!

    if (target.orientation === "horizontal") {
      targetStartPoint.y = anchor.constantCoord
      targetEndPoint.y = anchor.constantCoord
      this.closeRangeGap({
        path,
        target,
        anchor,
        axis: "x",
      })
    } else {
      targetStartPoint.x = anchor.constantCoord
      targetEndPoint.x = anchor.constantCoord
      this.closeRangeGap({
        path,
        target,
        anchor,
        axis: "y",
      })
    }
  }

  private closeRangeGap({
    path,
    target,
    anchor,
    axis,
  }: {
    path: Point[]
    target: SegmentLocator
    anchor: SegmentLocator
    axis: "x" | "y"
  }) {
    if (
      target.rangeEnd >= anchor.rangeStart &&
      anchor.rangeEnd >= target.rangeStart
    ) {
      return
    }

    const targetStartsBeforeAnchor = target.rangeEnd < anchor.rangeStart
    const targetPointIndex = targetStartsBeforeAnchor
      ? this.getPointIndexAtRangeEnd(target)
      : this.getPointIndexAtRangeStart(target)
    path[targetPointIndex]![axis] = targetStartsBeforeAnchor
      ? anchor.rangeStart
      : anchor.rangeEnd

    const outsideNeighborIndex =
      targetPointIndex === target.segmentIndex
        ? target.segmentIndex - 1
        : target.segmentIndex + 2
    if (path[outsideNeighborIndex]) {
      path[outsideNeighborIndex]![axis] = path[targetPointIndex]![axis]
    }
  }

  private getPointIndexAtRangeStart(segment: SegmentLocator): number {
    const firstCoord =
      segment.orientation === "horizontal" ? segment.p1.x : segment.p1.y
    return Math.abs(firstCoord - segment.rangeStart) < EPS
      ? segment.segmentIndex
      : segment.segmentIndex + 1
  }

  private getPointIndexAtRangeEnd(segment: SegmentLocator): number {
    const firstCoord =
      segment.orientation === "horizontal" ? segment.p1.x : segment.p1.y
    return Math.abs(firstCoord - segment.rangeEnd) < EPS
      ? segment.segmentIndex
      : segment.segmentIndex + 1
  }

  private pathTouchesChipObstacle(path: Point[]): boolean {
    return isPathCollidingWithObstacles(
      path,
      getObstacleRects(this.inputProblem),
    )
  }

  private isPathOrthogonal(path: Point[]): boolean {
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i]!
      const p2 = path[i + 1]!
      if (Math.abs(p1.x - p2.x) >= EPS && Math.abs(p1.y - p2.y) >= EPS) {
        return false
      }
    }
    return true
  }

  private pathCreatesNewCrossNetOverlap(
    previousPath: Point[],
    nextPath: Point[],
    targetTraceIndex: number,
  ): boolean {
    const targetTrace = this.outputTracePaths[targetTraceIndex]!
    for (let i = 0; i < this.outputTracePaths.length; i++) {
      if (i === targetTraceIndex) continue
      const otherTrace = this.outputTracePaths[i]!
      if (otherTrace.globalConnNetId === targetTrace.globalConnNetId) continue
      if (
        this.pathsTouch(nextPath, otherTrace.tracePath) &&
        !this.pathsTouch(previousPath, otherTrace.tracePath)
      ) {
        return true
      }
    }
    return false
  }

  private pathsTouch(pathA: Point[], pathB: Point[]): boolean {
    for (let i = 0; i < pathA.length - 1; i++) {
      for (let j = 0; j < pathB.length - 1; j++) {
        if (
          this.segmentsTouch(pathA[i]!, pathA[i + 1]!, pathB[j]!, pathB[j + 1]!)
        ) {
          return true
        }
      }
    }
    return false
  }

  private segmentsTouch(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
    const aHorizontal = Math.abs(a1.y - a2.y) < EPS
    const aVertical = Math.abs(a1.x - a2.x) < EPS
    const bHorizontal = Math.abs(b1.y - b2.y) < EPS
    const bVertical = Math.abs(b1.x - b2.x) < EPS

    if ((!aHorizontal && !aVertical) || (!bHorizontal && !bVertical)) {
      return false
    }

    if (aHorizontal && bHorizontal) {
      if (Math.abs(a1.y - b1.y) >= EPS) return false
      return this.rangesOverlap(a1.x, a2.x, b1.x, b2.x)
    }
    if (aVertical && bVertical) {
      if (Math.abs(a1.x - b1.x) >= EPS) return false
      return this.rangesOverlap(a1.y, a2.y, b1.y, b2.y)
    }

    const horizontal = aHorizontal
      ? { start: a1, end: a2 }
      : { start: b1, end: b2 }
    const vertical = aVertical ? { start: a1, end: a2 } : { start: b1, end: b2 }
    return (
      this.valueInRange(
        vertical.start.x,
        horizontal.start.x,
        horizontal.end.x,
      ) &&
      this.valueInRange(horizontal.start.y, vertical.start.y, vertical.end.y)
    )
  }

  private rangesOverlap(
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number,
  ): boolean {
    return (
      Math.max(Math.min(aStart, aEnd), Math.min(bStart, bEnd)) <=
      Math.min(Math.max(aStart, aEnd), Math.max(bStart, bEnd)) + EPS
    )
  }

  private valueInRange(value: number, start: number, end: number): boolean {
    return (
      value >= Math.min(start, end) - EPS && value <= Math.max(start, end) + EPS
    )
  }

  getOutput() {
    return {
      traces: this.outputTracePaths,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    for (const trace of this.outputTracePaths) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "green",
      })
    }

    return graphics
  }
}
