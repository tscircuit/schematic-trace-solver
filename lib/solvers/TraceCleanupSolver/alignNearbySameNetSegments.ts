import type { Point } from "@tscircuit/math-utils"
import { doSegmentsIntersect } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { simplifyPath } from "./simplifyPath"

type Axis = "horizontal" | "vertical"

interface TraceSegment {
  traceIndex: number
  segmentIndex: number
  trace: SolvedTracePath
  axis: Axis
  coordinate: number
  min: number
  max: number
  length: number
  isEndpointSegment: boolean
}

interface SegmentPair {
  moving: TraceSegment
  anchor: TraceSegment
  distance: number
  overlap: number
}

const EPS = 1e-9
const DEFAULT_ALIGNMENT_TOLERANCE = 0.15
const MIN_OVERLAP = 0.05
const MAX_ALIGNMENT_PASSES = 5

export const alignNearbySameNetSegments = (
  traces: SolvedTracePath[],
  opts: { tolerance?: number } = {},
): SolvedTracePath[] => {
  const tolerance = opts.tolerance ?? DEFAULT_ALIGNMENT_TOLERANCE
  let outputTraces = traces

  for (let pass = 0; pass < MAX_ALIGNMENT_PASSES; pass++) {
    const pairs = findAlignmentPairs(outputTraces, tolerance)
    let aligned = false

    for (const pair of pairs) {
      const updatedTrace = alignSegmentToCoordinate(
        pair.moving.trace,
        pair.moving.segmentIndex,
        pair.moving.axis,
        pair.anchor.coordinate,
      )

      if (
        traceHasDifferentNetCollision(
          updatedTrace,
          outputTraces,
          pair.moving.traceIndex,
        )
      ) {
        continue
      }

      outputTraces = outputTraces.map((trace, index) =>
        index === pair.moving.traceIndex ? updatedTrace : trace,
      )
      aligned = true
      break
    }

    if (!aligned) break
  }

  return outputTraces
}

const findAlignmentPairs = (
  traces: SolvedTracePath[],
  tolerance: number,
): SegmentPair[] => {
  const segments = traces.flatMap((trace, traceIndex) =>
    extractTraceSegments(trace, traceIndex).filter(
      (segment) => !segment.isEndpointSegment,
    ),
  )
  const pairs: SegmentPair[] = []

  for (let i = 0; i < segments.length; i++) {
    const first = segments[i]
    for (let j = i + 1; j < segments.length; j++) {
      const second = segments[j]
      if (first.trace.globalConnNetId !== second.trace.globalConnNetId) {
        continue
      }
      if (first.traceIndex === second.traceIndex) {
        continue
      }
      if (first.axis !== second.axis) {
        continue
      }

      const distance = Math.abs(first.coordinate - second.coordinate)
      if (distance <= EPS || distance > tolerance) {
        continue
      }

      const overlap = getOverlap(first, second)
      if (overlap < MIN_OVERLAP) {
        continue
      }

      const anchor =
        first.length > second.length ||
        (Math.abs(first.length - second.length) <= EPS &&
          first.traceIndex < second.traceIndex)
          ? first
          : second
      const moving = anchor === first ? second : first

      pairs.push({
        moving,
        anchor,
        distance,
        overlap,
      })
    }
  }

  pairs.sort((a, b) => {
    if (Math.abs(a.distance - b.distance) > EPS) {
      return a.distance - b.distance
    }
    return b.overlap - a.overlap
  })

  return pairs
}

const extractTraceSegments = (
  trace: SolvedTracePath,
  traceIndex: number,
): TraceSegment[] => {
  const segments: TraceSegment[] = []
  for (let i = 0; i < trace.tracePath.length - 1; i++) {
    const start = trace.tracePath[i]
    const end = trace.tracePath[i + 1]
    const axis = isHorizontal(start, end)
      ? "horizontal"
      : isVertical(start, end)
        ? "vertical"
        : null

    if (!axis) continue

    const min =
      axis === "horizontal"
        ? Math.min(start.x, end.x)
        : Math.min(start.y, end.y)
    const max =
      axis === "horizontal"
        ? Math.max(start.x, end.x)
        : Math.max(start.y, end.y)

    segments.push({
      traceIndex,
      segmentIndex: i,
      trace,
      axis,
      coordinate: axis === "horizontal" ? start.y : start.x,
      min,
      max,
      length: max - min,
      isEndpointSegment: i === 0 || i === trace.tracePath.length - 2,
    })
  }

  return segments
}

const getOverlap = (a: TraceSegment, b: TraceSegment) => {
  return Math.min(a.max, b.max) - Math.max(a.min, b.min)
}

const alignSegmentToCoordinate = (
  trace: SolvedTracePath,
  segmentIndex: number,
  axis: Axis,
  coordinate: number,
): SolvedTracePath => {
  const tracePath = trace.tracePath.map((point) => ({ ...point }))

  if (axis === "horizontal") {
    tracePath[segmentIndex] = { ...tracePath[segmentIndex], y: coordinate }
    tracePath[segmentIndex + 1] = {
      ...tracePath[segmentIndex + 1],
      y: coordinate,
    }
  } else {
    tracePath[segmentIndex] = { ...tracePath[segmentIndex], x: coordinate }
    tracePath[segmentIndex + 1] = {
      ...tracePath[segmentIndex + 1],
      x: coordinate,
    }
  }

  return {
    ...trace,
    tracePath: simplifyPath(tracePath),
  }
}

const traceHasDifferentNetCollision = (
  updatedTrace: SolvedTracePath,
  allTraces: SolvedTracePath[],
  updatedTraceIndex: number,
) => {
  for (const [traceIndex, otherTrace] of allTraces.entries()) {
    if (traceIndex === updatedTraceIndex) continue
    if (updatedTrace.globalConnNetId === otherTrace.globalConnNetId) continue

    if (pathsIntersect(updatedTrace.tracePath, otherTrace.tracePath)) {
      return true
    }
  }

  return false
}

const pathsIntersect = (firstPath: Point[], secondPath: Point[]) => {
  for (let i = 0; i < firstPath.length - 1; i++) {
    for (let j = 0; j < secondPath.length - 1; j++) {
      if (
        doSegmentsIntersect(
          firstPath[i],
          firstPath[i + 1],
          secondPath[j],
          secondPath[j + 1],
        )
      ) {
        return true
      }
    }
  }

  return false
}
