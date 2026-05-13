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

        const candidate = endpointCandidate(first, second, gapThreshold)
        if (!candidate) continue

        const mergedAxis = (candidate.firstAxis + candidate.secondAxis) / 2
        moveSegmentEndpoint(firstTrace, first, candidate.firstAxis, mergedAxis)
        moveSegmentEndpoint(
          secondTrace,
          second,
          candidate.secondAxis,
          mergedAxis,
        )
        changed = true
        break outer
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
