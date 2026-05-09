import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
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
  mergeDistance?: number
  minOverlap?: number
}

export class SameNetTraceCombiningSolver extends BaseSolver {
  private input: Required<SameNetTraceCombiningSolverInput>
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
