import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"

type Orientation = "horizontal" | "vertical"

interface SegmentLocator {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  axis: number
  min: number
  max: number
  length: number
  isTerminal: boolean
}

interface MergeCandidate {
  source: SegmentLocator
  target: SegmentLocator
  distance: number
  overlapLength: number
}

export class SameNetTraceCombiningSolver extends BaseSolver {
  inputProblem?: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  mergeDistance: number
  mergeCount = 0

  private readonly EPS = 1e-6
  private readonly MAX_PASSES = 100

  constructor(params: {
    inputProblem?: InputProblem
    traces: SolvedTracePath[]
    mergeDistance?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.traces
    this.outputTraces = params.traces.map((trace) => ({
      ...trace,
      tracePath: trace.tracePath.map((point) => ({ ...point })),
      mspConnectionPairIds: [...trace.mspConnectionPairIds],
      pinIds: [...trace.pinIds],
      pins: [{ ...trace.pins[0] }, { ...trace.pins[1] }],
    }))
    this.mergeDistance = params.mergeDistance ?? 0.15
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceCombiningSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.inputTraces,
      mergeDistance: this.mergeDistance,
    }
  }

  override _step() {
    for (let pass = 0; pass < this.MAX_PASSES; pass++) {
      const candidate = this.findBestCandidate()
      if (!candidate) break

      this.applyCandidate(candidate)
      this.mergeCount++
    }

    this.stats.mergeCount = this.mergeCount
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  private findBestCandidate(): MergeCandidate | null {
    const candidates: MergeCandidate[] = []
    const byNet = new Map<string, number[]>()

    for (
      let traceIndex = 0;
      traceIndex < this.outputTraces.length;
      traceIndex++
    ) {
      const trace = this.outputTraces[traceIndex]!
      if (!byNet.has(trace.globalConnNetId))
        byNet.set(trace.globalConnNetId, [])
      byNet.get(trace.globalConnNetId)!.push(traceIndex)
    }

    for (const traceIndexes of byNet.values()) {
      if (traceIndexes.length < 2) continue

      for (let i = 0; i < traceIndexes.length; i++) {
        for (let j = i + 1; j < traceIndexes.length; j++) {
          const traceAIndex = traceIndexes[i]!
          const traceBIndex = traceIndexes[j]!
          const segmentsA = this.getTraceSegments(traceAIndex)
          const segmentsB = this.getTraceSegments(traceBIndex)

          for (const segmentA of segmentsA) {
            for (const segmentB of segmentsB) {
              const candidate = this.getCandidate(segmentA, segmentB)
              if (candidate && this.canApplyCandidate(candidate)) {
                candidates.push(candidate)
              }
            }
          }
        }
      }
    }

    candidates.sort((a, b) => {
      if (Math.abs(a.distance - b.distance) > this.EPS) {
        return a.distance - b.distance
      }
      if (Math.abs(a.overlapLength - b.overlapLength) > this.EPS) {
        return b.overlapLength - a.overlapLength
      }
      const traceDelta = a.source.traceIndex - b.source.traceIndex
      if (traceDelta !== 0) return traceDelta
      return a.source.segmentIndex - b.source.segmentIndex
    })

    return candidates[0] ?? null
  }

  private getTraceSegments(traceIndex: number): SegmentLocator[] {
    const trace = this.outputTraces[traceIndex]!
    const segments: SegmentLocator[] = []

    for (
      let segmentIndex = 0;
      segmentIndex < trace.tracePath.length - 1;
      segmentIndex++
    ) {
      const start = trace.tracePath[segmentIndex]!
      const end = trace.tracePath[segmentIndex + 1]!
      const orientation = this.getOrientation(start, end)
      if (!orientation) continue

      const isHorizontal = orientation === "horizontal"
      const min = isHorizontal
        ? Math.min(start.x, end.x)
        : Math.min(start.y, end.y)
      const max = isHorizontal
        ? Math.max(start.x, end.x)
        : Math.max(start.y, end.y)
      const axis = isHorizontal ? start.y : start.x
      const length = max - min

      if (length <= this.EPS) continue

      segments.push({
        traceIndex,
        segmentIndex,
        orientation,
        axis,
        min,
        max,
        length,
        isTerminal:
          segmentIndex === 0 || segmentIndex === trace.tracePath.length - 2,
      })
    }

    return segments
  }

  private getCandidate(
    segmentA: SegmentLocator,
    segmentB: SegmentLocator,
  ): MergeCandidate | null {
    if (segmentA.orientation !== segmentB.orientation) return null

    const distance = Math.abs(segmentA.axis - segmentB.axis)
    if (distance <= this.EPS || distance > this.mergeDistance) return null

    const overlapLength =
      Math.min(segmentA.max, segmentB.max) -
      Math.max(segmentA.min, segmentB.min)
    if (overlapLength <= this.EPS) return null

    const source = this.chooseSourceSegment(segmentA, segmentB)
    if (!source) return null

    const target = source === segmentA ? segmentB : segmentA

    return {
      source,
      target,
      distance,
      overlapLength,
    }
  }

  private chooseSourceSegment(
    segmentA: SegmentLocator,
    segmentB: SegmentLocator,
  ): SegmentLocator | null {
    if (segmentA.isTerminal && segmentB.isTerminal) return null
    if (segmentA.isTerminal) return segmentB
    if (segmentB.isTerminal) return segmentA

    if (Math.abs(segmentA.length - segmentB.length) > this.EPS) {
      return segmentA.length < segmentB.length ? segmentA : segmentB
    }

    if (segmentA.traceIndex !== segmentB.traceIndex) {
      return segmentA.traceIndex > segmentB.traceIndex ? segmentA : segmentB
    }

    return segmentA.segmentIndex > segmentB.segmentIndex ? segmentA : segmentB
  }

  private canApplyCandidate(candidate: MergeCandidate): boolean {
    const sourceTrace = this.outputTraces[candidate.source.traceIndex]!
    const proposedTrace = this.getTraceWithSegmentOnAxis(
      sourceTrace,
      candidate.source.segmentIndex,
      candidate.source.orientation,
      candidate.target.axis,
    )

    const oldIntersections = this.getDifferentNetIntersectionKeys(sourceTrace)
    const newIntersections = this.getDifferentNetIntersectionKeys(proposedTrace)

    for (const key of newIntersections) {
      if (!oldIntersections.has(key)) return false
    }

    return true
  }

  private applyCandidate(candidate: MergeCandidate) {
    const sourceTrace = this.outputTraces[candidate.source.traceIndex]!
    this.outputTraces[candidate.source.traceIndex] =
      this.getTraceWithSegmentOnAxis(
        sourceTrace,
        candidate.source.segmentIndex,
        candidate.source.orientation,
        candidate.target.axis,
      )
  }

  private getTraceWithSegmentOnAxis(
    trace: SolvedTracePath,
    segmentIndex: number,
    orientation: Orientation,
    axis: number,
  ): SolvedTracePath {
    const tracePath = trace.tracePath.map((point) => ({ ...point }))
    const start = tracePath[segmentIndex]!
    const end = tracePath[segmentIndex + 1]!

    if (orientation === "horizontal") {
      start.y = axis
      end.y = axis
    } else {
      start.x = axis
      end.x = axis
    }

    return {
      ...trace,
      tracePath: this.removeConsecutiveDuplicatePoints(tracePath),
    }
  }

  private removeConsecutiveDuplicatePoints(points: Point[]): Point[] {
    const cleaned: Point[] = []

    for (const point of points) {
      const prev = cleaned[cleaned.length - 1]
      if (!prev || !this.samePoint(prev, point)) {
        cleaned.push(point)
      }
    }

    return cleaned
  }

  private getDifferentNetIntersectionKeys(trace: SolvedTracePath): Set<string> {
    const keys = new Set<string>()
    const traceSegments = this.getSegmentsFromTrace(trace)

    for (const otherTrace of this.outputTraces) {
      if (otherTrace.mspPairId === trace.mspPairId) continue
      if (otherTrace.globalConnNetId === trace.globalConnNetId) continue

      const otherSegments = this.getSegmentsFromTrace(otherTrace)

      for (const traceSegment of traceSegments) {
        for (const otherSegment of otherSegments) {
          const intersection = this.getSegmentIntersectionKey(
            traceSegment,
            otherSegment,
          )
          if (intersection) {
            keys.add(`${otherTrace.mspPairId}:${intersection}`)
          }
        }
      }
    }

    return keys
  }

  private getSegmentsFromTrace(trace: SolvedTracePath) {
    return trace.tracePath
      .slice(0, -1)
      .map((start, index) => {
        const end = trace.tracePath[index + 1]!
        const orientation = this.getOrientation(start, end)
        if (!orientation) return null

        return {
          orientation,
          start,
          end,
          axis: orientation === "horizontal" ? start.y : start.x,
          min:
            orientation === "horizontal"
              ? Math.min(start.x, end.x)
              : Math.min(start.y, end.y),
          max:
            orientation === "horizontal"
              ? Math.max(start.x, end.x)
              : Math.max(start.y, end.y),
        }
      })
      .filter(Boolean) as Array<{
      orientation: Orientation
      start: Point
      end: Point
      axis: number
      min: number
      max: number
    }>
  }

  private getSegmentIntersectionKey(
    segmentA: {
      orientation: Orientation
      axis: number
      min: number
      max: number
    },
    segmentB: {
      orientation: Orientation
      axis: number
      min: number
      max: number
    },
  ): string | null {
    if (segmentA.orientation === segmentB.orientation) {
      if (Math.abs(segmentA.axis - segmentB.axis) > this.EPS) return null

      const overlapMin = Math.max(segmentA.min, segmentB.min)
      const overlapMax = Math.min(segmentA.max, segmentB.max)
      if (overlapMax - overlapMin <= this.EPS) return null

      return [
        "overlap",
        segmentA.orientation,
        this.round(segmentA.axis),
        this.round(overlapMin),
        this.round(overlapMax),
      ].join(":")
    }

    const horizontal =
      segmentA.orientation === "horizontal" ? segmentA : segmentB
    const vertical = segmentA.orientation === "vertical" ? segmentA : segmentB

    if (
      !this.isStrictlyBetween(vertical.axis, horizontal.min, horizontal.max)
    ) {
      return null
    }
    if (!this.isStrictlyBetween(horizontal.axis, vertical.min, vertical.max)) {
      return null
    }

    return [
      "cross",
      this.round(vertical.axis),
      this.round(horizontal.axis),
    ].join(":")
  }

  private getOrientation(start: Point, end: Point): Orientation | null {
    if (Math.abs(start.y - end.y) <= this.EPS) return "horizontal"
    if (Math.abs(start.x - end.x) <= this.EPS) return "vertical"
    return null
  }

  private isStrictlyBetween(value: number, a: number, b: number): boolean {
    return (
      value > Math.min(a, b) + this.EPS && value < Math.max(a, b) - this.EPS
    )
  }

  private samePoint(a: Point, b: Point): boolean {
    return Math.abs(a.x - b.x) <= this.EPS && Math.abs(a.y - b.y) <= this.EPS
  }

  private round(value: number): string {
    return value.toFixed(6)
  }

  override visualize(): GraphicsObject {
    const graphics = this.inputProblem
      ? visualizeInputProblem(this.inputProblem, {
          chipAlpha: 0.1,
          connectionAlpha: 0.1,
        })
      : {
          lines: [],
          points: [],
          rects: [],
          circles: [],
          texts: [],
        }

    graphics.lines = graphics.lines ?? []

    for (const trace of this.outputTraces) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: getColorFromString(trace.globalConnNetId, 0.85),
      })
    }

    return graphics
  }
}
