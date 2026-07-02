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
  netId: string
}

interface RectObstacle {
  chipId: string
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface AlignSameNetTraceSegmentsOptions {
  inputProblem?: InputProblem
  allLabelPlacements?: NetLabelPlacement[]
  mergedLabelNetIdMap?: Record<string, Set<string>>
  paddingBuffer?: number
  maxAlignmentDistance?: number
  maxEndpointGap?: number
  maxIterations?: number
}

interface AlignSameNetTraceSegmentsParams
  extends AlignSameNetTraceSegmentsOptions {
  traces: SolvedTracePath[]
}

const EPS = 1e-6
const TRACE_WIDTH = 0.01
const STATIC_OBSTACLE_PADDING = 0.01

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  tracePath: trace.tracePath.map((point) => ({ ...point })),
})

const normalizePath = (path: Point[]): Point[] => {
  const withoutDuplicatePoints: Point[] = []

  for (const point of path) {
    const previous = withoutDuplicatePoints[withoutDuplicatePoints.length - 1]
    if (
      previous &&
      Math.abs(previous.x - point.x) < EPS &&
      Math.abs(previous.y - point.y) < EPS
    ) {
      continue
    }
    withoutDuplicatePoints.push(point)
  }

  return simplifyPath(withoutDuplicatePoints)
}

const collectInteriorSegments = (
  traces: SolvedTracePath[],
  traceIndex: number,
): SegmentRef[] => {
  const trace = traces[traceIndex]!
  const segments: SegmentRef[] = []

  for (
    let segmentIndex = 1;
    segmentIndex < trace.tracePath.length - 2;
    segmentIndex++
  ) {
    const start = trace.tracePath[segmentIndex]!
    const end = trace.tracePath[segmentIndex + 1]!

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
          netId: trace.globalConnNetId,
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
          netId: trace.globalConnNetId,
        })
      }
    }
  }

  return segments
}

const areEquivalentNetIds = (
  leftNetId: string,
  rightNetId: string,
  mergedLabelNetIdMap: Record<string, Set<string>> = {},
) => {
  if (leftNetId === rightNetId) return true
  return (
    mergedLabelNetIdMap[leftNetId]?.has(rightNetId) === true ||
    mergedLabelNetIdMap[rightNetId]?.has(leftNetId) === true
  )
}

const rangesAreNear = (
  left: SegmentRef,
  right: SegmentRef,
  maxEndpointGap: number,
) =>
  Math.max(left.min, right.min) - Math.min(left.max, right.max) <=
  maxEndpointGap

const segmentsAreClusterable = (
  left: SegmentRef,
  right: SegmentRef,
  params: Required<
    Pick<
      AlignSameNetTraceSegmentsParams,
      "maxAlignmentDistance" | "maxEndpointGap"
    >
  > & {
    mergedLabelNetIdMap?: Record<string, Set<string>>
  },
) =>
  left.traceIndex !== right.traceIndex &&
  left.orientation === right.orientation &&
  areEquivalentNetIds(left.netId, right.netId, params.mergedLabelNetIdMap) &&
  Math.abs(left.fixedCoord - right.fixedCoord) <= params.maxAlignmentDistance &&
  rangesAreNear(left, right, params.maxEndpointGap)

const getSegmentKey = (segment: SegmentRef) =>
  `${segment.traceIndex}:${segment.segmentIndex}`

const getCandidateClusters = (
  segments: SegmentRef[],
  params: Required<
    Pick<
      AlignSameNetTraceSegmentsParams,
      "maxAlignmentDistance" | "maxEndpointGap"
    >
  > & {
    mergedLabelNetIdMap?: Record<string, Set<string>>
  },
) => {
  const visited = new Set<string>()
  const clusters: SegmentRef[][] = []

  for (const segment of segments) {
    const segmentKey = getSegmentKey(segment)
    if (visited.has(segmentKey)) continue

    const cluster: SegmentRef[] = []
    const queue = [segment]
    visited.add(segmentKey)

    while (queue.length > 0) {
      const current = queue.shift()!
      cluster.push(current)

      for (const candidate of segments) {
        const candidateKey = getSegmentKey(candidate)
        if (visited.has(candidateKey)) continue
        if (!segmentsAreClusterable(current, candidate, params)) continue

        visited.add(candidateKey)
        queue.push(candidate)
      }
    }

    if (cluster.length > 1) clusters.push(cluster)
  }

  return clusters.sort((left, right) => {
    const rightLength = right.reduce((sum, segment) => sum + segment.length, 0)
    const leftLength = left.reduce((sum, segment) => sum + segment.length, 0)
    return right.length - left.length || rightLength - leftLength
  })
}

const getAnchorSegment = (cluster: SegmentRef[]) =>
  cluster.reduce((best, segment) => {
    if (segment.length > best.length + EPS) return segment
    if (
      Math.abs(segment.length - best.length) < EPS &&
      segment.traceIndex < best.traceIndex
    ) {
      return segment
    }
    return best
  }, cluster[0]!)

const rectFromSegment = (
  start: Point,
  end: Point,
  chipId: string,
): RectObstacle => ({
  chipId,
  minX: Math.min(start.x, end.x) - TRACE_WIDTH / 2,
  minY: Math.min(start.y, end.y) - TRACE_WIDTH / 2,
  maxX: Math.max(start.x, end.x) + TRACE_WIDTH / 2,
  maxY: Math.max(start.y, end.y) + TRACE_WIDTH / 2,
})

const getBlockingRectsForTrace = (
  traces: SolvedTracePath[],
  traceIndex: number,
  params: AlignSameNetTraceSegmentsOptions,
): RectObstacle[] => {
  const targetTrace = traces[traceIndex]!

  const staticObstacles =
    params.inputProblem?.chips === undefined
      ? []
      : getObstacleRects(params.inputProblem).map((obstacle) => ({
          ...obstacle,
          minX: obstacle.minX - STATIC_OBSTACLE_PADDING,
          minY: obstacle.minY - STATIC_OBSTACLE_PADDING,
          maxX: obstacle.maxX + STATIC_OBSTACLE_PADDING,
          maxY: obstacle.maxY + STATIC_OBSTACLE_PADDING,
        }))

  const traceObstacles = traces.flatMap((trace, otherTraceIndex) => {
    if (otherTraceIndex === traceIndex) return []
    if (
      areEquivalentNetIds(
        trace.globalConnNetId,
        targetTrace.globalConnNetId,
        params.mergedLabelNetIdMap,
      )
    ) {
      return []
    }

    return trace.tracePath.slice(0, -1).map((start, segmentIndex) => {
      const end = trace.tracePath[segmentIndex + 1]!
      return rectFromSegment(
        start,
        end,
        `trace-${otherTraceIndex}-${segmentIndex}`,
      )
    })
  })

  const labelObstacles = (params.allLabelPlacements ?? [])
    .filter(
      (label) =>
        !areEquivalentNetIds(
          label.globalConnNetId,
          targetTrace.globalConnNetId,
          params.mergedLabelNetIdMap,
        ),
    )
    .map((label) => ({
      chipId: `label-${label.globalConnNetId}`,
      minX: label.center.x - label.width / 2 - (params.paddingBuffer ?? 0),
      minY: label.center.y - label.height / 2 - (params.paddingBuffer ?? 0),
      maxX: label.center.x + label.width / 2 + (params.paddingBuffer ?? 0),
      maxY: label.center.y + label.height / 2 + (params.paddingBuffer ?? 0),
    }))

  return [...staticObstacles, ...traceObstacles, ...labelObstacles]
}

const countIntersections = (path: Point[], obstacles: RectObstacle[]) => {
  let intersections = 0

  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]!
    const end = path[i + 1]!
    for (const obstacle of obstacles) {
      if (segmentIntersectsRect(start, end, obstacle)) {
        intersections++
      }
    }
  }

  return intersections
}

const getMovedPath = (
  trace: SolvedTracePath,
  segment: SegmentRef,
  targetFixedCoord: number,
) => {
  const nextPath = trace.tracePath.map((point) => ({ ...point }))
  const start = nextPath[segment.segmentIndex]!
  const end = nextPath[segment.segmentIndex + 1]!

  if (segment.orientation === "horizontal") {
    start.y = targetFixedCoord
    end.y = targetFixedCoord
  } else {
    start.x = targetFixedCoord
    end.x = targetFixedCoord
  }

  return normalizePath(nextPath)
}

const canMoveSegment = (
  traces: SolvedTracePath[],
  segment: SegmentRef,
  targetFixedCoord: number,
  params: AlignSameNetTraceSegmentsOptions,
) => {
  const trace = traces[segment.traceIndex]!
  const movedPath = getMovedPath(trace, segment, targetFixedCoord)
  const blockingRects = getBlockingRectsForTrace(
    traces,
    segment.traceIndex,
    params,
  )

  return (
    countIntersections(movedPath, blockingRects) <=
    countIntersections(trace.tracePath, blockingRects)
  )
}

const applySegmentMove = (
  traces: SolvedTracePath[],
  segment: SegmentRef,
  targetFixedCoord: number,
) => {
  const trace = traces[segment.traceIndex]!
  traces[segment.traceIndex] = {
    ...trace,
    tracePath: getMovedPath(trace, segment, targetFixedCoord),
  }
}

export const alignSameNetTraceSegments = ({
  traces,
  maxAlignmentDistance = 0.12,
  maxEndpointGap = 0.05,
  maxIterations = 25,
  ...params
}: AlignSameNetTraceSegmentsParams) => {
  const outputTraces = traces.map(cloneTrace)
  let changed = false

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const segments = outputTraces.flatMap((_, traceIndex) =>
      collectInteriorSegments(outputTraces, traceIndex),
    )
    const clusters = getCandidateClusters(segments, {
      maxAlignmentDistance,
      maxEndpointGap,
      mergedLabelNetIdMap: params.mergedLabelNetIdMap,
    })

    let changedThisIteration = false

    for (const cluster of clusters) {
      const anchor = getAnchorSegment(cluster)
      for (const segment of cluster) {
        if (getSegmentKey(segment) === getSegmentKey(anchor)) continue
        if (Math.abs(segment.fixedCoord - anchor.fixedCoord) < EPS) continue
        if (!canMoveSegment(outputTraces, segment, anchor.fixedCoord, params)) {
          continue
        }

        applySegmentMove(outputTraces, segment, anchor.fixedCoord)
        changed = true
        changedThisIteration = true
      }

      if (changedThisIteration) break
    }

    if (!changedThisIteration) break
  }

  return {
    changed,
    traces: outputTraces,
  }
}
