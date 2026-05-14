import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export interface SameNetTraceMergeSolverInput {
  traces: SolvedTracePath[]
  gapThreshold?: number
}

type Segment = {
  traceIndex: number
  startIndex: number
  endIndex: number
  orientation: "horizontal" | "vertical"
  fixed: number
  min: number
  max: number
}

const DEFAULT_GAP_THRESHOLD = 0.15
const EPSILON = 1e-9

function almostEqual(a: number, b: number) {
  return Math.abs(a - b) <= EPSILON
}

function getAxisValue(segment: Segment, point: { x: number; y: number }) {
  return segment.orientation === "horizontal" ? point.x : point.y
}

function setAxisValue(
  point: { x: number; y: number },
  orientation: "horizontal" | "vertical",
  value: number,
) {
  if (orientation === "horizontal") point.x = value
  else point.y = value
}

function setFixedValue(
  point: { x: number; y: number },
  orientation: "horizontal" | "vertical",
  value: number,
) {
  if (orientation === "horizontal") point.y = value
  else point.x = value
}

function getSegments(trace: SolvedTracePath, traceIndex: number): Segment[] {
  const segments: Segment[] = []

  for (let i = 0; i < trace.tracePath.length - 1; i++) {
    const start = trace.tracePath[i]!
    const end = trace.tracePath[i + 1]!

    if (almostEqual(start.y, end.y) && !almostEqual(start.x, end.x)) {
      segments.push({
        traceIndex,
        startIndex: i,
        endIndex: i + 1,
        orientation: "horizontal",
        fixed: start.y,
        min: Math.min(start.x, end.x),
        max: Math.max(start.x, end.x),
      })
    } else if (almostEqual(start.x, end.x) && !almostEqual(start.y, end.y)) {
      segments.push({
        traceIndex,
        startIndex: i,
        endIndex: i + 1,
        orientation: "vertical",
        fixed: start.x,
        min: Math.min(start.y, end.y),
        max: Math.max(start.y, end.y),
      })
    }
  }

  return segments
}

function endpointCandidate(
  first: Segment,
  second: Segment,
  gapThreshold: number,
) {
  if (first.traceIndex === second.traceIndex) return null
  if (first.orientation !== second.orientation) return null
  if (!almostEqual(first.fixed, second.fixed)) return null

  const gapForward = second.min - first.max
  const gapBackward = first.min - second.max

  if (gapForward > EPSILON && gapForward <= gapThreshold) {
    return { firstAxis: first.max, secondAxis: second.min }
  }

  if (gapBackward > EPSILON && gapBackward <= gapThreshold) {
    return { firstAxis: first.min, secondAxis: second.max }
  }

  return null
}

function overlappingParallelCandidate(
  first: Segment,
  second: Segment,
  gapThreshold: number,
) {
  if (first.traceIndex === second.traceIndex) return null
  if (first.orientation !== second.orientation) return null

  const fixedDistance = Math.abs(first.fixed - second.fixed)
  if (fixedDistance <= EPSILON || fixedDistance > gapThreshold) return null

  const overlapMin = Math.max(first.min, second.min)
  const overlapMax = Math.min(first.max, second.max)
  if (overlapMax - overlapMin <= EPSILON) return null

  return true
}

function isInternalSegment(trace: SolvedTracePath, segment: Segment) {
  return segment.startIndex > 0 && segment.endIndex < trace.tracePath.length - 1
}

function getSnappedFixedValue(
  firstTrace: SolvedTracePath,
  first: Segment,
  secondTrace: SolvedTracePath,
  second: Segment,
) {
  const canMoveFirst = isInternalSegment(firstTrace, first)
  const canMoveSecond = isInternalSegment(secondTrace, second)

  if (canMoveFirst && canMoveSecond) return (first.fixed + second.fixed) / 2
  if (canMoveFirst) return second.fixed
  if (canMoveSecond) return first.fixed

  return null
}

function cloneTraces(traces: SolvedTracePath[]) {
  return traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))
}

function rangesOverlap(
  firstMin: number,
  firstMax: number,
  secondMin: number,
  secondMax: number,
) {
  return (
    Math.min(firstMax, secondMax) - Math.max(firstMin, secondMin) >= -EPSILON
  )
}

function axisAlignedSegmentsIntersect(
  firstTrace: SolvedTracePath,
  first: Segment,
  secondTrace: SolvedTracePath,
  second: Segment,
) {
  if (first.orientation === second.orientation) {
    return (
      almostEqual(first.fixed, second.fixed) &&
      rangesOverlap(first.min, first.max, second.min, second.max)
    )
  }

  const horizontal = first.orientation === "horizontal" ? first : second
  const vertical = first.orientation === "vertical" ? first : second
  return (
    vertical.fixed >= horizontal.min - EPSILON &&
    vertical.fixed <= horizontal.max + EPSILON &&
    horizontal.fixed >= vertical.min - EPSILON &&
    horizontal.fixed <= vertical.max + EPSILON
  )
}

function countDifferentNetIntersections(traces: SolvedTracePath[]) {
  const segments = traces.flatMap((trace, traceIndex) =>
    getSegments(trace, traceIndex),
  )
  let intersections = 0

  for (let i = 0; i < segments.length; i++) {
    const first = segments[i]!
    const firstTrace = traces[first.traceIndex]!
    for (let j = i + 1; j < segments.length; j++) {
      const second = segments[j]!
      const secondTrace = traces[second.traceIndex]!
      if (firstTrace.globalConnNetId === secondTrace.globalConnNetId) continue
      if (
        axisAlignedSegmentsIntersect(firstTrace, first, secondTrace, second)
      ) {
        intersections++
      }
    }
  }

  return intersections
}

function moveParallelSegmentsSafely(
  traces: SolvedTracePath[],
  first: Segment,
  second: Segment,
  snappedFixed: number,
) {
  const candidateTraces = cloneTraces(traces)
  const candidateFirstTrace = candidateTraces[first.traceIndex]!
  const candidateSecondTrace = candidateTraces[second.traceIndex]!

  if (isInternalSegment(candidateFirstTrace, first)) {
    moveSegmentFixed(candidateFirstTrace, first, snappedFixed)
  }
  if (isInternalSegment(candidateSecondTrace, second)) {
    moveSegmentFixed(candidateSecondTrace, second, snappedFixed)
  }

  if (
    countDifferentNetIntersections(candidateTraces) >
    countDifferentNetIntersections(traces)
  ) {
    return false
  }

  traces.splice(0, traces.length, ...candidateTraces)
  return true
}

function moveSegmentEndpoint(
  trace: SolvedTracePath,
  segment: Segment,
  axisValue: number,
  replacementAxisValue: number,
) {
  const points = trace.tracePath
  for (const index of [segment.startIndex, segment.endIndex]) {
    const point = points[index]!
    if (almostEqual(getAxisValue(segment, point), axisValue)) {
      setAxisValue(point, segment.orientation, replacementAxisValue)
    }
  }
}

function moveSegmentFixed(
  trace: SolvedTracePath,
  segment: Segment,
  replacementFixedValue: number,
) {
  const points = trace.tracePath
  setFixedValue(
    points[segment.startIndex]!,
    segment.orientation,
    replacementFixedValue,
  )
  setFixedValue(
    points[segment.endIndex]!,
    segment.orientation,
    replacementFixedValue,
  )
}

export function mergeSameNetTraceSegments({
  traces,
  gapThreshold = DEFAULT_GAP_THRESHOLD,
}: SameNetTraceMergeSolverInput): SolvedTracePath[] {
  const mergedTraces: SolvedTracePath[] = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  let changed = true
  let safetyCounter = 0

  while (changed && safetyCounter++ < 20) {
    changed = false
    const segments = mergedTraces.flatMap((trace, traceIndex) =>
      getSegments(trace, traceIndex),
    )

    outer: for (let i = 0; i < segments.length; i++) {
      const first = segments[i]!
      const firstTrace = mergedTraces[first.traceIndex]!

      for (let j = i + 1; j < segments.length; j++) {
        const second = segments[j]!
        const secondTrace = mergedTraces[second.traceIndex]!

        if (firstTrace.globalConnNetId !== secondTrace.globalConnNetId) continue

        const endpointMerge = endpointCandidate(first, second, gapThreshold)
        if (endpointMerge) {
          const mergedAxis =
            (endpointMerge.firstAxis + endpointMerge.secondAxis) / 2
          moveSegmentEndpoint(
            firstTrace,
            first,
            endpointMerge.firstAxis,
            mergedAxis,
          )
          moveSegmentEndpoint(
            secondTrace,
            second,
            endpointMerge.secondAxis,
            mergedAxis,
          )
          changed = true
          break outer
        }

        const parallelMerge = overlappingParallelCandidate(
          first,
          second,
          gapThreshold,
        )
        if (parallelMerge) {
          const snappedFixed = getSnappedFixedValue(
            firstTrace,
            first,
            secondTrace,
            second,
          )
          if (snappedFixed === null) continue

          if (
            !moveParallelSegmentsSafely(
              mergedTraces,
              first,
              second,
              snappedFixed,
            )
          ) {
            continue
          }
          changed = true
          break outer
        }
      }
    }
  }

  return mergedTraces
}

export class SameNetTraceMergeSolver extends BaseSolver {
  private input: SameNetTraceMergeSolverInput
  private outputTraces: SolvedTracePath[]

  constructor(input: SameNetTraceMergeSolverInput) {
    super()
    this.input = input
    this.outputTraces = input.traces
  }

  override _step() {
    this.outputTraces = mergeSameNetTraceSegments(this.input)
    this.solved = true
  }

  getOutput() {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    const lines: Line[] = this.outputTraces.map((trace) => ({
      points: trace.tracePath,
      strokeColor: "blue",
    }))

    return { lines }
  }
}
