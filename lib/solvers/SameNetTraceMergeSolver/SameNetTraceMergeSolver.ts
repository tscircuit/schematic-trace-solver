import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"

type MergeAxis = "x" | "y"

interface SameNetTraceMergeSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  mergeDistance?: number
  minOverlap?: number
}

interface TraceSegment {
  traceIndex: number
  segmentIndex: number
  globalConnNetId: string
  axis: MergeAxis
  constantCoord: number
  start: number
  end: number
}

const EPS = 2e-3
const DEFAULT_MERGE_DISTANCE = 0.15
const DEFAULT_MIN_OVERLAP = 0.05

const clonePoint = (point: Point): Point => ({ x: point.x, y: point.y })

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  tracePath: trace.tracePath.map(clonePoint),
})

const rangesOverlap = (
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) => Math.min(aEnd, bEnd) - Math.max(aStart, bStart)

const isHorizontal = (p1: Point, p2: Point) => Math.abs(p1.y - p2.y) < EPS
const isVertical = (p1: Point, p2: Point) => Math.abs(p1.x - p2.x) < EPS

const canMoveSegment = (
  points: Point[],
  segmentIndex: number,
  axis: MergeAxis,
) => {
  if (segmentIndex === 0 || segmentIndex >= points.length - 2) return false

  const p1 = points[segmentIndex]!
  const p2 = points[segmentIndex + 1]!
  const prev = points[segmentIndex - 1]
  const next = points[segmentIndex + 2]

  if (axis === "y") {
    if (prev && Math.abs(prev.x - p1.x) >= EPS) return false
    if (next && Math.abs(next.x - p2.x) >= EPS) return false
  } else {
    if (prev && Math.abs(prev.y - p1.y) >= EPS) return false
    if (next && Math.abs(next.y - p2.y) >= EPS) return false
  }

  return true
}

const getMergeableSegments = (traces: SolvedTracePath[]): TraceSegment[] => {
  const segments: TraceSegment[] = []

  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const trace = traces[traceIndex]!
    const points = trace.tracePath

    for (
      let segmentIndex = 0;
      segmentIndex < points.length - 1;
      segmentIndex++
    ) {
      const p1 = points[segmentIndex]!
      const p2 = points[segmentIndex + 1]!
      const horizontal = isHorizontal(p1, p2)
      const vertical = isVertical(p1, p2)

      if (!horizontal && !vertical) continue

      const axis: MergeAxis = horizontal ? "y" : "x"
      if (!canMoveSegment(points, segmentIndex, axis)) continue

      segments.push({
        traceIndex,
        segmentIndex,
        globalConnNetId: trace.globalConnNetId,
        axis,
        constantCoord: horizontal ? p1.y : p1.x,
        start: horizontal ? Math.min(p1.x, p2.x) : Math.min(p1.y, p2.y),
        end: horizontal ? Math.max(p1.x, p2.x) : Math.max(p1.y, p2.y),
      })
    }
  }

  return segments
}

const hasDifferentNetBetweenSegments = (
  a: TraceSegment,
  b: TraceSegment,
  allSegments: TraceSegment[],
  minOverlap: number,
) => {
  const lowerCoord = Math.min(a.constantCoord, b.constantCoord)
  const upperCoord = Math.max(a.constantCoord, b.constantCoord)

  return allSegments.some((candidate) => {
    if (candidate.globalConnNetId === a.globalConnNetId) return false
    if (candidate.axis !== a.axis) return false
    if (candidate.constantCoord <= lowerCoord + EPS) return false
    if (candidate.constantCoord >= upperCoord - EPS) return false

    return (
      rangesOverlap(a.start, a.end, candidate.start, candidate.end) >=
        minOverlap &&
      rangesOverlap(b.start, b.end, candidate.start, candidate.end) >=
        minOverlap
    )
  })
}

const shouldMergeSegments = (
  a: TraceSegment,
  b: TraceSegment,
  allSegments: TraceSegment[],
  mergeDistance: number,
  minOverlap: number,
) => {
  if (a.traceIndex === b.traceIndex) return false
  if (a.globalConnNetId !== b.globalConnNetId) return false
  if (a.axis !== b.axis) return false
  if (Math.abs(a.constantCoord - b.constantCoord) > mergeDistance) return false
  if (rangesOverlap(a.start, a.end, b.start, b.end) < minOverlap) return false
  if (hasDifferentNetBetweenSegments(a, b, allSegments, minOverlap))
    return false

  return true
}

const getMergeComponents = (
  segments: TraceSegment[],
  mergeDistance: number,
  minOverlap: number,
) => {
  const visited = new Set<number>()
  const components: TraceSegment[][] = []

  for (let i = 0; i < segments.length; i++) {
    if (visited.has(i)) continue

    const queue = [i]
    const component: TraceSegment[] = []
    visited.add(i)

    while (queue.length > 0) {
      const currentIndex = queue.shift()!
      const current = segments[currentIndex]!
      component.push(current)

      for (let j = 0; j < segments.length; j++) {
        if (visited.has(j)) continue

        if (
          shouldMergeSegments(
            current,
            segments[j]!,
            segments,
            mergeDistance,
            minOverlap,
          )
        ) {
          visited.add(j)
          queue.push(j)
        }
      }
    }

    if (component.length > 1) {
      components.push(component)
    }
  }

  return components
}

const moveSegmentToCoord = (
  points: Point[],
  segmentIndex: number,
  axis: MergeAxis,
  coord: number,
) => {
  const p1 = points[segmentIndex]!
  const p2 = points[segmentIndex + 1]!

  if (axis === "y") {
    p1.y = coord
    p2.y = coord
  } else {
    p1.x = coord
    p2.x = coord
  }
}

export const mergeSameNetTraceSegments = (
  traces: SolvedTracePath[],
  opts: {
    mergeDistance?: number
    minOverlap?: number
  } = {},
) => {
  const mergeDistance = opts.mergeDistance ?? DEFAULT_MERGE_DISTANCE
  const minOverlap = opts.minOverlap ?? DEFAULT_MIN_OVERLAP
  const outputTraces = traces.map(cloneTrace)
  const segments = getMergeableSegments(outputTraces)
  const components = getMergeComponents(segments, mergeDistance, minOverlap)

  for (const component of components) {
    const targetCoord =
      component.reduce((sum, segment) => sum + segment.constantCoord, 0) /
      component.length

    for (const segment of component) {
      moveSegmentToCoord(
        outputTraces[segment.traceIndex]!.tracePath,
        segment.segmentIndex,
        segment.axis,
        targetCoord,
      )
    }
  }

  return {
    traces: outputTraces.map((trace) => ({
      ...trace,
      tracePath: simplifyPath(trace.tracePath),
    })),
    mergeCount: components.length,
  }
}

export class SameNetTraceMergeSolver extends BaseSolver {
  private input: SameNetTraceMergeSolverInput
  outputTraces: SolvedTracePath[]
  mergeCount = 0

  constructor(input: SameNetTraceMergeSolverInput) {
    super()
    this.input = input
    this.outputTraces = input.traces.map(cloneTrace)
  }

  override _step() {
    const output = mergeSameNetTraceSegments(this.outputTraces, {
      mergeDistance: this.input.mergeDistance,
      minOverlap: this.input.minOverlap,
    })

    this.outputTraces = output.traces
    this.mergeCount = output.mergeCount
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      mergeCount: this.mergeCount,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.input.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    graphics.lines = graphics.lines ?? []

    for (const trace of this.outputTraces) {
      const line: Line = {
        points: trace.tracePath,
        strokeColor: "purple",
      }
      graphics.lines.push(line)
    }

    return graphics
  }
}
