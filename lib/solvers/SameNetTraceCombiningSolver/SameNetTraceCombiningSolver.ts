import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import {
  getObstacleRects,
  type ChipWithBounds,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"

type Axis = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  pointIndex: number
  axis: Axis
  constantCoord: number
  start: number
  end: number
  length: number
  isTerminal: boolean
}

interface SameNetTraceCombiningSolverInput {
  traces: SolvedTracePath[]
  inputProblem?: InputProblem
  netLabelPlacements?: NetLabelPlacement[]
  mergeDistance?: number
  minOverlap?: number
}

export class SameNetTraceCombiningSolver extends BaseSolver {
  private input: SameNetTraceCombiningSolverInput & {
    mergeDistance: number
    minOverlap: number
  }
  outputTraces: SolvedTracePath[]
  mergedSegmentCount = 0

  constructor(input: SameNetTraceCombiningSolverInput) {
    super()
    this.input = {
      ...input,
      mergeDistance: input.mergeDistance ?? 0.15,
      minOverlap: input.minOverlap ?? 0.05,
    }
    this.outputTraces = input.traces.map((trace) => ({
      ...trace,
      tracePath: trace.tracePath.map((point) => ({ ...point })),
      mspConnectionPairIds: [...trace.mspConnectionPairIds],
      pinIds: [...trace.pinIds],
    }))
  }

  override _step() {
    const tracesByNet = new Map<string, SolvedTracePath[]>()

    for (const trace of this.outputTraces) {
      const traces = tracesByNet.get(trace.globalConnNetId) ?? []
      traces.push(trace)
      tracesByNet.set(trace.globalConnNetId, traces)
    }

    for (const traces of tracesByNet.values()) {
      if (traces.length < 2) continue
      let didCombine = true
      while (didCombine) {
        didCombine = this.combineTraceGroup(traces)
      }
    }

    this.outputTraces = this.outputTraces.map((trace) => ({
      ...trace,
      tracePath: simplifyPath(trace.tracePath),
    }))
    this.solved = true
  }

  private combineTraceGroup(groupTraces: SolvedTracePath[]): boolean {
    const traceIndexById = new Map(
      this.outputTraces.map((trace, index) => [trace.mspPairId, index]),
    )
    const segments = groupTraces.flatMap((trace) =>
      this.getSegmentRefs(
        this.outputTraces[traceIndexById.get(trace.mspPairId)!]!,
      ).map((segment) => ({
        ...segment,
        traceIndex: traceIndexById.get(trace.mspPairId)!,
      })),
    )

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const first = segments[i]!
        const second = segments[j]!

        if (first.traceIndex === second.traceIndex) continue
        if (first.axis !== second.axis) continue
        if (!this.shouldCombineSegments(first, second)) continue

        const target = this.getTargetSegment(first, second)
        if (!target) continue
        const source = target === first ? second : first
        if (!this.canSnapSegmentToCoordinate(source, target.constantCoord)) {
          continue
        }
        this.snapSegmentToCoordinate(source, target.constantCoord)
        this.mergedSegmentCount++
        return true
      }
    }

    return false
  }

  private getSegmentRefs(trace: SolvedTracePath): SegmentRef[] {
    const segments: SegmentRef[] = []

    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const startPoint = trace.tracePath[i]!
      const endPoint = trace.tracePath[i + 1]!

      if (this.areEqual(startPoint.y, endPoint.y)) {
        const start = Math.min(startPoint.x, endPoint.x)
        const end = Math.max(startPoint.x, endPoint.x)
        segments.push({
          traceIndex: -1,
          pointIndex: i,
          axis: "horizontal",
          constantCoord: startPoint.y,
          start,
          end,
          length: end - start,
          isTerminal: i === 0 || i + 1 === trace.tracePath.length - 1,
        })
      } else if (this.areEqual(startPoint.x, endPoint.x)) {
        const start = Math.min(startPoint.y, endPoint.y)
        const end = Math.max(startPoint.y, endPoint.y)
        segments.push({
          traceIndex: -1,
          pointIndex: i,
          axis: "vertical",
          constantCoord: startPoint.x,
          start,
          end,
          length: end - start,
          isTerminal: i === 0 || i + 1 === trace.tracePath.length - 1,
        })
      }
    }

    return segments
  }

  private shouldCombineSegments(
    first: SegmentRef,
    second: SegmentRef,
  ): boolean {
    const distance = Math.abs(first.constantCoord - second.constantCoord)
    if (distance <= 1e-9 || distance > this.input.mergeDistance) return false

    const overlap =
      Math.min(first.end, second.end) - Math.max(first.start, second.start)

    return overlap >= this.input.minOverlap
  }

  private getTargetSegment(
    first: SegmentRef,
    second: SegmentRef,
  ): SegmentRef | null {
    if (first.isTerminal && second.isTerminal) return null
    if (first.isTerminal) return first
    if (second.isTerminal) return second

    if (first.length !== second.length) {
      return first.length > second.length ? first : second
    }
    return first.constantCoord <= second.constantCoord ? first : second
  }

  private snapSegmentToCoordinate(segment: SegmentRef, coordinate: number) {
    const trace = this.outputTraces[segment.traceIndex]!
    const firstPoint = trace.tracePath[segment.pointIndex]!
    const secondPoint = trace.tracePath[segment.pointIndex + 1]!

    if (segment.axis === "horizontal") {
      firstPoint.y = coordinate
      secondPoint.y = coordinate
    } else {
      firstPoint.x = coordinate
      secondPoint.x = coordinate
    }
  }

  private canSnapSegmentToCoordinate(
    segment: SegmentRef,
    coordinate: number,
  ): boolean {
    const trace = this.outputTraces[segment.traceIndex]!
    const candidatePath = trace.tracePath.map((point) => ({ ...point }))
    const firstPoint = candidatePath[segment.pointIndex]!
    const secondPoint = candidatePath[segment.pointIndex + 1]!

    if (segment.axis === "horizontal") {
      firstPoint.y = coordinate
      secondPoint.y = coordinate
    } else {
      firstPoint.x = coordinate
      secondPoint.x = coordinate
    }

    const originalCollisions = this.collectBlockingCollisionKeys(
      trace,
      trace.tracePath,
    )
    const candidateCollisions = this.collectBlockingCollisionKeys(
      trace,
      candidatePath,
    )

    for (const key of candidateCollisions) {
      if (!originalCollisions.has(key)) return false
    }

    return true
  }

  private collectBlockingCollisionKeys(
    trace: SolvedTracePath,
    tracePath: Point[],
  ): Set<string> {
    return new Set([
      ...this.collectRectCollisionKeys(tracePath),
      ...this.collectDifferentNetTraceCollisionKeys(trace, tracePath),
    ])
  }

  private collectRectCollisionKeys(tracePath: Point[]): string[] {
    const rects = this.getBlockingRects()
    const collisions: string[] = []

    for (
      let segmentIndex = 0;
      segmentIndex < tracePath.length - 1;
      segmentIndex++
    ) {
      const start = tracePath[segmentIndex]!
      const end = tracePath[segmentIndex + 1]!

      for (const rect of rects) {
        if (segmentIntersectsRect(start, end, rect)) {
          collisions.push(`rect:${rect.chipId}:segment:${segmentIndex}`)
        }
      }
    }

    return collisions
  }

  private getBlockingRects(): ChipWithBounds[] {
    const chipRects = this.input.inputProblem
      ? getObstacleRects(this.input.inputProblem)
      : []
    const labelRects =
      this.input.netLabelPlacements?.map((label, index) => ({
        chipId: `net-label-${index}-${label.globalConnNetId}`,
        minX: label.center.x - label.width / 2,
        minY: label.center.y - label.height / 2,
        maxX: label.center.x + label.width / 2,
        maxY: label.center.y + label.height / 2,
      })) ?? []

    return [...chipRects, ...labelRects]
  }

  private collectDifferentNetTraceCollisionKeys(
    trace: SolvedTracePath,
    tracePath: Point[],
  ): string[] {
    const collisions: string[] = []

    for (const otherTrace of this.outputTraces) {
      if (otherTrace.mspPairId === trace.mspPairId) continue
      if (otherTrace.globalConnNetId === trace.globalConnNetId) continue

      for (
        let segmentIndex = 0;
        segmentIndex < tracePath.length - 1;
        segmentIndex++
      ) {
        const start = tracePath[segmentIndex]!
        const end = tracePath[segmentIndex + 1]!

        for (
          let otherSegmentIndex = 0;
          otherSegmentIndex < otherTrace.tracePath.length - 1;
          otherSegmentIndex++
        ) {
          const otherStart = otherTrace.tracePath[otherSegmentIndex]!
          const otherEnd = otherTrace.tracePath[otherSegmentIndex + 1]!

          if (this.segmentsIntersect(start, end, otherStart, otherEnd)) {
            collisions.push(
              `trace:${otherTrace.mspPairId}:segment:${otherSegmentIndex}:with:${segmentIndex}`,
            )
          }
        }
      }
    }

    return collisions
  }

  private segmentsIntersect(
    a1: Point,
    a2: Point,
    b1: Point,
    b2: Point,
  ): boolean {
    const aHorizontal = this.areEqual(a1.y, a2.y)
    const aVertical = this.areEqual(a1.x, a2.x)
    const bHorizontal = this.areEqual(b1.y, b2.y)
    const bVertical = this.areEqual(b1.x, b2.x)

    if ((!aHorizontal && !aVertical) || (!bHorizontal && !bVertical)) {
      return false
    }

    if (aHorizontal && bVertical) {
      return (
        this.pointOnSegment({ x: b1.x, y: a1.y }, a1, a2) &&
        this.pointOnSegment({ x: b1.x, y: a1.y }, b1, b2)
      )
    }

    if (aVertical && bHorizontal) {
      return (
        this.pointOnSegment({ x: a1.x, y: b1.y }, a1, a2) &&
        this.pointOnSegment({ x: a1.x, y: b1.y }, b1, b2)
      )
    }

    if (aHorizontal && bHorizontal && this.areEqual(a1.y, b1.y)) {
      return this.rangesOverlap(a1.x, a2.x, b1.x, b2.x)
    }

    if (aVertical && bVertical && this.areEqual(a1.x, b1.x)) {
      return this.rangesOverlap(a1.y, a2.y, b1.y, b2.y)
    }

    return false
  }

  private pointOnSegment(point: Point, start: Point, end: Point): boolean {
    return (
      point.x >= Math.min(start.x, end.x) - 1e-9 &&
      point.x <= Math.max(start.x, end.x) + 1e-9 &&
      point.y >= Math.min(start.y, end.y) - 1e-9 &&
      point.y <= Math.max(start.y, end.y) + 1e-9
    )
  }

  private rangesOverlap(
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number,
  ): boolean {
    return (
      Math.min(Math.max(aStart, aEnd), Math.max(bStart, bEnd)) -
        Math.max(Math.min(aStart, aEnd), Math.min(bStart, bEnd)) >
      1e-9
    )
  }

  private areEqual(first: number, second: number): boolean {
    return Math.abs(first - second) < 1e-9
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const lines: Line[] = this.outputTraces.map((trace) => ({
      points: trace.tracePath.map((point: Point) => ({
        x: point.x,
        y: point.y,
      })),
      strokeColor: getColorFromString(trace.globalConnNetId, 0.85),
    }))

    return {
      lines,
      points: [],
      rects: [],
      circles: [],
      texts: [],
    }
  }
}
