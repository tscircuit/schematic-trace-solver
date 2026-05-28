import type { Point } from "@tscircuit/math-utils"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"

type Orientation = "horizontal" | "vertical"

interface TraceSegment {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  axis: number
  min: number
  max: number
  movable: boolean
}

interface MergeCandidate {
  segmentA: TraceSegment
  segmentB: TraceSegment
  targetAxis: number
}

const EPS = 1e-6
const DEFAULT_MERGE_TOLERANCE = 0.2
const MIN_OVERLAP_LENGTH = 0.05

export class SameNetTraceMergingSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  mergeTolerance: number
  lastMergeCandidate: MergeCandidate | null = null

  constructor(params: {
    inputProblem: InputProblem
    inputTraces: SolvedTracePath[]
    mergeTolerance?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.inputTraces
    this.outputTraces = params.inputTraces.map(cloneTrace)
    this.mergeTolerance = params.mergeTolerance ?? DEFAULT_MERGE_TOLERANCE
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceMergingSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTraces: this.inputTraces,
      mergeTolerance: this.mergeTolerance,
    }
  }

  override _step() {
    const candidate = this.findNextMergeCandidate()

    if (!candidate) {
      this.solved = true
      return
    }

    this.lastMergeCandidate = candidate
    this.alignSegment(candidate.segmentA, candidate.targetAxis)
    this.alignSegment(candidate.segmentB, candidate.targetAxis)
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  private findNextMergeCandidate(): MergeCandidate | null {
    const tracesByNet = new Map<string, number[]>()

    for (let i = 0; i < this.outputTraces.length; i++) {
      const trace = this.outputTraces[i]!
      const traces = tracesByNet.get(trace.globalConnNetId) ?? []
      traces.push(i)
      tracesByNet.set(trace.globalConnNetId, traces)
    }

    for (const traceIndexes of tracesByNet.values()) {
      if (traceIndexes.length < 2) continue

      const segments = traceIndexes.flatMap((traceIndex) =>
        this.getSegmentsForTrace(traceIndex),
      )

      for (let i = 0; i < segments.length; i++) {
        const segmentA = segments[i]!
        for (let j = i + 1; j < segments.length; j++) {
          const segmentB = segments[j]!
          if (segmentA.traceIndex === segmentB.traceIndex) continue
          if (segmentA.orientation !== segmentB.orientation) continue
          if (!segmentA.movable && !segmentB.movable) continue

          const axisDistance = Math.abs(segmentA.axis - segmentB.axis)
          if (axisDistance < EPS || axisDistance > this.mergeTolerance) continue
          if (getOverlapLength(segmentA, segmentB) < MIN_OVERLAP_LENGTH)
            continue

          const targetAxis = this.getTargetAxis(segmentA, segmentB)
          if (!this.canAlignSegment(segmentA, targetAxis)) continue
          if (!this.canAlignSegment(segmentB, targetAxis)) continue

          return { segmentA, segmentB, targetAxis }
        }
      }
    }

    return null
  }

  private getTargetAxis(segmentA: TraceSegment, segmentB: TraceSegment) {
    if (segmentA.movable && segmentB.movable) {
      return (segmentA.axis + segmentB.axis) / 2
    }
    return segmentA.movable ? segmentB.axis : segmentA.axis
  }

  private getSegmentsForTrace(traceIndex: number): TraceSegment[] {
    const trace = this.outputTraces[traceIndex]!
    const segments: TraceSegment[] = []

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

      const orientation: Orientation = isHorizontal ? "horizontal" : "vertical"
      segments.push({
        traceIndex,
        segmentIndex,
        orientation,
        axis: orientation === "horizontal" ? p1.y : p1.x,
        min:
          orientation === "horizontal"
            ? Math.min(p1.x, p2.x)
            : Math.min(p1.y, p2.y),
        max:
          orientation === "horizontal"
            ? Math.max(p1.x, p2.x)
            : Math.max(p1.y, p2.y),
        movable: this.isSegmentMovable(trace, segmentIndex),
      })
    }

    return segments
  }

  private isSegmentMovable(trace: SolvedTracePath, segmentIndex: number) {
    return segmentIndex > 0 && segmentIndex < trace.tracePath.length - 2
  }

  private canAlignSegment(segment: TraceSegment, targetAxis: number) {
    if (Math.abs(segment.axis - targetAxis) < EPS) return true
    if (!segment.movable) return false

    const updatedTrace = cloneTrace(this.outputTraces[segment.traceIndex]!)
    moveSegmentAxis(updatedTrace.tracePath, segment, targetAxis)
    normalizeTracePath(updatedTrace.tracePath)

    return !this.hasDifferentNetOverlap(updatedTrace, segment.traceIndex)
  }

  private alignSegment(segment: TraceSegment, targetAxis: number) {
    if (!segment.movable || Math.abs(segment.axis - targetAxis) < EPS) return

    const trace = this.outputTraces[segment.traceIndex]!
    moveSegmentAxis(trace.tracePath, segment, targetAxis)
    normalizeTracePath(trace.tracePath)
  }

  private hasDifferentNetOverlap(
    updatedTrace: SolvedTracePath,
    updatedTraceIndex: number,
  ) {
    const updatedSegments = getTraceSegments(updatedTrace)

    for (
      let traceIndex = 0;
      traceIndex < this.outputTraces.length;
      traceIndex++
    ) {
      if (traceIndex === updatedTraceIndex) continue

      const otherTrace = this.outputTraces[traceIndex]!
      if (otherTrace.globalConnNetId === updatedTrace.globalConnNetId) continue

      for (const updatedSegment of updatedSegments) {
        for (const otherSegment of getTraceSegments(otherTrace)) {
          if (updatedSegment.orientation !== otherSegment.orientation) continue
          if (Math.abs(updatedSegment.axis - otherSegment.axis) > EPS) continue
          if (getOverlapLength(updatedSegment, otherSegment) > EPS) return true
        }
      }
    }

    return false
  }

  override visualize() {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    for (const trace of this.outputTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: getColorFromString(trace.globalConnNetId, 0.85),
      })
    }

    return graphics
  }
}

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  pins: [...trace.pins] as SolvedTracePath["pins"],
  tracePath: trace.tracePath.map((point) => ({ ...point })),
  mspConnectionPairIds: [...trace.mspConnectionPairIds],
  pinIds: [...trace.pinIds],
})

const moveSegmentAxis = (
  tracePath: Point[],
  segment: Pick<TraceSegment, "segmentIndex" | "orientation">,
  targetAxis: number,
) => {
  const p1 = tracePath[segment.segmentIndex]!
  const p2 = tracePath[segment.segmentIndex + 1]!

  if (segment.orientation === "horizontal") {
    p1.y = targetAxis
    p2.y = targetAxis
  } else {
    p1.x = targetAxis
    p2.x = targetAxis
  }
}

const normalizeTracePath = (tracePath: Point[]) => {
  for (let i = tracePath.length - 1; i > 0; i--) {
    if (pointsEqual(tracePath[i]!, tracePath[i - 1]!)) {
      tracePath.splice(i, 1)
    }
  }

  for (let i = tracePath.length - 2; i > 0; i--) {
    const prev = tracePath[i - 1]!
    const cur = tracePath[i]!
    const next = tracePath[i + 1]!
    const allHorizontal =
      Math.abs(prev.y - cur.y) < EPS && Math.abs(cur.y - next.y) < EPS
    const allVertical =
      Math.abs(prev.x - cur.x) < EPS && Math.abs(cur.x - next.x) < EPS

    if (allHorizontal || allVertical) {
      tracePath.splice(i, 1)
    }
  }
}

const pointsEqual = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

const getTraceSegments = (trace: SolvedTracePath): TraceSegment[] => {
  const segments: TraceSegment[] = []

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

    const orientation: Orientation = isHorizontal ? "horizontal" : "vertical"
    segments.push({
      traceIndex: 0,
      segmentIndex,
      orientation,
      axis: orientation === "horizontal" ? p1.y : p1.x,
      min:
        orientation === "horizontal"
          ? Math.min(p1.x, p2.x)
          : Math.min(p1.y, p2.y),
      max:
        orientation === "horizontal"
          ? Math.max(p1.x, p2.x)
          : Math.max(p1.y, p2.y),
      movable: false,
    })
  }

  return segments
}

const getOverlapLength = (
  segmentA: Pick<TraceSegment, "min" | "max">,
  segmentB: Pick<TraceSegment, "min" | "max">,
) => Math.min(segmentA.max, segmentB.max) - Math.max(segmentA.min, segmentB.min)
