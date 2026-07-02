import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { simplifyPath } from "./simplifyPath"

type Orientation = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  fixedCoord: number
  min: number
  max: number
  length: number
}

export interface SameNetAlignmentOptions {
  maxAlignmentDistance?: number
  maxEndpointGap?: number
  maxIterations?: number
  inputProblem?: InputProblem
  allLabelPlacements?: NetLabelPlacement[]
  mergedLabelNetIdMap?: Record<string, Set<string>>
  paddingBuffer?: number
}

const EPS = 1e-6
const TRACE_WIDTH = 0.01
const STATIC_OBSTACLE_PADDING = 0.01

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  tracePath: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
})

const normalizePath = (path: Point[]): Point[] => {
  const deduped: Point[] = []
  for (const point of path) {
    const previous = deduped[deduped.length - 1]
    if (
      previous &&
      Math.abs(previous.x - point.x) < EPS &&
      Math.abs(previous.y - point.y) < EPS
    ) {
      continue
    }
    deduped.push(point)
  }
  return simplifyPath(deduped)
}

const collectInteriorSegments = (
  traces: SolvedTracePath[],
  traceIndex: number,
): SegmentRef[] => {
  const path = traces[traceIndex]!.tracePath
  const segments: SegmentRef[] = []

  for (let segmentIndex = 1; segmentIndex < path.length - 2; segmentIndex++) {
    const start = path[segmentIndex]!
    const end = path[segmentIndex + 1]!

    if (Math.abs(start.y - end.y) < EPS) {
      const min = Math.min(start.x, end.x)
      const max = Math.max(start.x, end.x)
      if (max - min > EPS) {
        segments.push({
          traceIndex,
          segmentIndex,
          orientation: "horizontal",
          fixedCoord: start.y,
          min,
          max,
          length: max - min,
        })
      }
    } else if (Math.abs(start.x - end.x) < EPS) {
      const min = Math.min(start.y, end.y)
      const max = Math.max(start.y, end.y)
      if (max - min > EPS) {
        segments.push({
          traceIndex,
          segmentIndex,
          orientation: "vertical",
          fixedCoord: start.x,
          min,
          max,
          length: max - min,
        })
      }
    }
  }

  return segments
}

const rangesAreClose = (a: SegmentRef, b: SegmentRef, maxEndpointGap: number) =>
  Math.max(a.min, b.min) - Math.min(a.max, b.max) <= maxEndpointGap

const netIdsMatch = (
  a: string,
  b: string,
  mergedLabelNetIdMap: Record<string, Set<string>> = {},
) => {
  if (a === b) return true
  return (
    mergedLabelNetIdMap[a]?.has(b) === true ||
    mergedLabelNetIdMap[b]?.has(a) === true
  )
}

const rectFromSegment = (p1: Point, p2: Point, chipId: string) => ({
  chipId,
  minX: Math.min(p1.x, p2.x) - TRACE_WIDTH / 2,
  minY: Math.min(p1.y, p2.y) - TRACE_WIDTH / 2,
  maxX: Math.max(p1.x, p2.x) + TRACE_WIDTH / 2,
  maxY: Math.max(p1.y, p2.y) + TRACE_WIDTH / 2,
})

const getBlockingRectsForTrace = (
  traces: SolvedTracePath[],
  traceIndex: number,
  {
    inputProblem,
    allLabelPlacements = [],
    mergedLabelNetIdMap = {},
    paddingBuffer = 0,
  }: SameNetAlignmentOptions,
) => {
  const targetTrace = traces[traceIndex]!
  const staticObstacles = inputProblem
    ? getObstacleRects(inputProblem).map((obs) => ({
        ...obs,
        minX: obs.minX - STATIC_OBSTACLE_PADDING,
        minY: obs.minY - STATIC_OBSTACLE_PADDING,
        maxX: obs.maxX + STATIC_OBSTACLE_PADDING,
        maxY: obs.maxY + STATIC_OBSTACLE_PADDING,
      }))
    : []

  const traceObstacles = traces.flatMap((trace, otherTraceIndex) => {
    if (otherTraceIndex === traceIndex) return []
    if (
      netIdsMatch(
        trace.globalConnNetId,
        targetTrace.globalConnNetId,
        mergedLabelNetIdMap,
      )
    ) {
      return []
    }

    return trace.tracePath.slice(0, -1).map((p1, segmentIndex) => {
      const p2 = trace.tracePath[segmentIndex + 1]!
      return rectFromSegment(
        p1,
        p2,
        `trace-obstacle-${otherTraceIndex}-${segmentIndex}`,
      )
    })
  })

  const labelBounds = allLabelPlacements
    .filter(
      (label) =>
        !netIdsMatch(
          label.globalConnNetId,
          targetTrace.globalConnNetId,
          mergedLabelNetIdMap,
        ),
    )
    .map((label) => ({
      chipId: `label-obstacle-${label.globalConnNetId}`,
      minX: label.center.x - label.width / 2 - paddingBuffer,
      maxX: label.center.x + label.width / 2 + paddingBuffer,
      minY: label.center.y - label.height / 2 - paddingBuffer,
      maxY: label.center.y + label.height / 2 + paddingBuffer,
    }))

  return [...staticObstacles, ...traceObstacles, ...labelBounds]
}

const countPathRectIntersections = (
  path: Point[],
  rects: ReturnType<typeof getBlockingRectsForTrace>,
) => {
  let count = 0
  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]!
    const end = path[i + 1]!
    for (const rect of rects) {
      if (segmentIntersectsRect(start, end, rect)) count++
    }
  }
  return count
}

const getMovedPath = (
  traces: SolvedTracePath[],
  segment: SegmentRef,
  targetCoord: number,
) => {
  const trace = traces[segment.traceIndex]!
  const nextPath = trace.tracePath.map((p) => ({ x: p.x, y: p.y }))
  const start = nextPath[segment.segmentIndex]!
  const end = nextPath[segment.segmentIndex + 1]!

  if (segment.orientation === "horizontal") {
    start.y = targetCoord
    end.y = targetCoord
  } else {
    start.x = targetCoord
    end.x = targetCoord
  }

  return normalizePath(nextPath)
}

const canMoveSegmentToCoord = (
  traces: SolvedTracePath[],
  segment: SegmentRef,
  targetCoord: number,
  options: SameNetAlignmentOptions,
) => {
  if (!options.inputProblem && !options.allLabelPlacements?.length) return true

  const originalPath = traces[segment.traceIndex]!.tracePath
  const movedPath = getMovedPath(traces, segment, targetCoord)
  const blockingRects = getBlockingRectsForTrace(
    traces,
    segment.traceIndex,
    options,
  )

  return (
    countPathRectIntersections(movedPath, blockingRects) <=
    countPathRectIntersections(originalPath, blockingRects)
  )
}

const findNextAlignment = (
  traces: SolvedTracePath[],
  maxAlignmentDistance: number,
  maxEndpointGap: number,
  options: SameNetAlignmentOptions,
) => {
  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const trace = traces[traceIndex]!
    const sameNetTraces = traces
      .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
      .filter(
        ({ candidate, candidateIndex }) =>
          candidateIndex > traceIndex &&
          candidate.globalConnNetId === trace.globalConnNetId,
      )

    const leftSegments = collectInteriorSegments(traces, traceIndex)
    for (const { candidateIndex } of sameNetTraces) {
      const rightSegments = collectInteriorSegments(traces, candidateIndex)

      for (const left of leftSegments) {
        for (const right of rightSegments) {
          if (left.orientation !== right.orientation) continue
          if (!rangesAreClose(left, right, maxEndpointGap)) continue
          if (
            Math.abs(left.fixedCoord - right.fixedCoord) > maxAlignmentDistance
          ) {
            continue
          }

          const keep = left.length >= right.length ? left : right
          const move = keep === left ? right : left
          if (Math.abs(move.fixedCoord - keep.fixedCoord) < EPS) continue
          if (!canMoveSegmentToCoord(traces, move, keep.fixedCoord, options)) {
            continue
          }

          return {
            targetCoord: keep.fixedCoord,
            segment: move,
          }
        }
      }
    }
  }

  return null
}

const moveSegmentToCoord = (
  traces: SolvedTracePath[],
  segment: SegmentRef,
  targetCoord: number,
) => {
  const trace = traces[segment.traceIndex]!

  traces[segment.traceIndex] = {
    ...trace,
    tracePath: getMovedPath(traces, segment, targetCoord),
  }
}

export const alignNearbySameNetTraceSegments = (
  traces: SolvedTracePath[],
  options: SameNetAlignmentOptions = {},
) => {
  const {
    maxAlignmentDistance = 0.12,
    maxEndpointGap = 0.05,
    maxIterations = 100,
  } = options
  const outputTraces = traces.map(cloneTrace)
  let changed = false

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const alignment = findNextAlignment(
      outputTraces,
      maxAlignmentDistance,
      maxEndpointGap,
      options,
    )
    if (!alignment) break

    moveSegmentToCoord(outputTraces, alignment.segment, alignment.targetCoord)
    changed = true
  }

  return {
    changed,
    traces: outputTraces,
  }
}
