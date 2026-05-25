import type { Point } from "@tscircuit/math-utils"
import {
  doSegmentsIntersect,
  getSegmentIntersection,
} from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  segmentIntersectsRect,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { ChipWithBounds } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
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
const STATIC_OBSTACLE_TOLERANCE = 1e-5
const COLLISION_KEY_PRECISION = 1e6

export const alignNearbySameNetSegments = (
  traces: SolvedTracePath[],
  opts: { tolerance?: number; inputProblem?: InputProblem } = {},
): SolvedTracePath[] => {
  const tolerance = opts.tolerance ?? DEFAULT_ALIGNMENT_TOLERANCE
  const staticObstacles = opts.inputProblem
    ? getObstacleRects(opts.inputProblem).map((obs) => ({
        ...obs,
        minX: obs.minX + STATIC_OBSTACLE_TOLERANCE,
        maxX: obs.maxX - STATIC_OBSTACLE_TOLERANCE,
        minY: obs.minY + STATIC_OBSTACLE_TOLERANCE,
        maxY: obs.maxY - STATIC_OBSTACLE_TOLERANCE,
      }))
    : []
  let outputTraces = traces
  const seenTraceStates = new Set<string>()

  while (true) {
    seenTraceStates.add(getTraceStateKey(outputTraces))
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
        introducesDifferentNetCollision(
          pair.moving.trace,
          updatedTrace,
          outputTraces,
          pair.moving.traceIndex,
        ) ||
        introducesStaticObstacleCollision(
          pair.moving.trace,
          updatedTrace,
          staticObstacles,
        )
      ) {
        continue
      }

      const candidateTraces = outputTraces.map((trace, index) =>
        index === pair.moving.traceIndex ? updatedTrace : trace,
      )
      if (seenTraceStates.has(getTraceStateKey(candidateTraces))) {
        continue
      }

      outputTraces = candidateTraces
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

const introducesDifferentNetCollision = (
  originalTrace: SolvedTracePath,
  updatedTrace: SolvedTracePath,
  allTraces: SolvedTracePath[],
  updatedTraceIndex: number,
) => {
  for (const [traceIndex, otherTrace] of allTraces.entries()) {
    if (traceIndex === updatedTraceIndex) continue
    if (updatedTrace.globalConnNetId === otherTrace.globalConnNetId) continue

    const originalCollisions = getPathCollisionKeys(
      originalTrace.tracePath,
      otherTrace.tracePath,
    )
    const updatedCollisions = getPathCollisionKeys(
      updatedTrace.tracePath,
      otherTrace.tracePath,
    )
    if (hasNewCollision(originalCollisions, updatedCollisions)) {
      return true
    }
  }

  return false
}

const introducesStaticObstacleCollision = (
  originalTrace: SolvedTracePath,
  updatedTrace: SolvedTracePath,
  staticObstacles: ChipWithBounds[],
) => {
  for (const obstacle of staticObstacles) {
    const originalCollisions = getObstacleCollisionKeys(
      originalTrace.tracePath,
      obstacle,
    )
    const updatedCollisions = getObstacleCollisionKeys(
      updatedTrace.tracePath,
      obstacle,
    )

    if (hasNewCollision(originalCollisions, updatedCollisions)) {
      return true
    }
  }

  return false
}

const hasNewCollision = (
  originalCollisions: Set<string>,
  updatedCollisions: Set<string>,
) => {
  for (const collision of updatedCollisions) {
    if (!originalCollisions.has(collision)) {
      return true
    }
  }

  return false
}

const getPathCollisionKeys = (firstPath: Point[], secondPath: Point[]) => {
  const collisions = new Set<string>()
  for (let i = 0; i < firstPath.length - 1; i++) {
    for (let j = 0; j < secondPath.length - 1; j++) {
      const collisionKey = getSegmentCollisionKey(
        firstPath[i],
        firstPath[i + 1],
        secondPath[j],
        secondPath[j + 1],
      )
      if (collisionKey) {
        collisions.add(collisionKey)
      }
    }
  }

  return collisions
}

const getSegmentCollisionKey = (
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
) => {
  const intersection = getSegmentIntersection(
    firstStart,
    firstEnd,
    secondStart,
    secondEnd,
  )
  if (intersection) {
    return `point:${pointKey(intersection)}`
  }

  if (!doSegmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
    return null
  }

  return (
    getCollinearOverlapKey(firstStart, firstEnd, secondStart, secondEnd) ??
    [
      "segment-pair",
      segmentKey(firstStart, firstEnd),
      segmentKey(secondStart, secondEnd),
    ].join(":")
  )
}

const getCollinearOverlapKey = (
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
) => {
  if (
    isHorizontal(firstStart, firstEnd) &&
    isHorizontal(secondStart, secondEnd) &&
    Math.abs(firstStart.y - secondStart.y) <= EPS
  ) {
    const minX = Math.max(
      Math.min(firstStart.x, firstEnd.x),
      Math.min(secondStart.x, secondEnd.x),
    )
    const maxX = Math.min(
      Math.max(firstStart.x, firstEnd.x),
      Math.max(secondStart.x, secondEnd.x),
    )
    return `horizontal-overlap:${formatNumber(firstStart.y)}:${formatNumber(minX)}:${formatNumber(maxX)}`
  }

  if (
    isVertical(firstStart, firstEnd) &&
    isVertical(secondStart, secondEnd) &&
    Math.abs(firstStart.x - secondStart.x) <= EPS
  ) {
    const minY = Math.max(
      Math.min(firstStart.y, firstEnd.y),
      Math.min(secondStart.y, secondEnd.y),
    )
    const maxY = Math.min(
      Math.max(firstStart.y, firstEnd.y),
      Math.max(secondStart.y, secondEnd.y),
    )
    return `vertical-overlap:${formatNumber(firstStart.x)}:${formatNumber(minY)}:${formatNumber(maxY)}`
  }

  return null
}

const getObstacleCollisionKeys = (path: Point[], obstacle: ChipWithBounds) => {
  const collisions = new Set<string>()
  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]
    const end = path[i + 1]
    if (!segmentIntersectsRect(start, end, obstacle)) {
      continue
    }

    if (isHorizontal(start, end)) {
      const minX = Math.max(Math.min(start.x, end.x), obstacle.minX)
      const maxX = Math.min(Math.max(start.x, end.x), obstacle.maxX)
      collisions.add(
        `horizontal-obstacle:${formatNumber(start.y)}:${formatNumber(minX)}:${formatNumber(maxX)}`,
      )
    } else if (isVertical(start, end)) {
      const minY = Math.max(Math.min(start.y, end.y), obstacle.minY)
      const maxY = Math.min(Math.max(start.y, end.y), obstacle.maxY)
      collisions.add(
        `vertical-obstacle:${formatNumber(start.x)}:${formatNumber(minY)}:${formatNumber(maxY)}`,
      )
    }
  }

  return collisions
}

const getTraceStateKey = (traces: SolvedTracePath[]) => {
  return traces
    .map((trace) => trace.tracePath.map(pointKey).join(";"))
    .join("|")
}

const segmentKey = (start: Point, end: Point) => {
  return `${pointKey(start)}>${pointKey(end)}`
}

const pointKey = (point: Point) => {
  return `${formatNumber(point.x)},${formatNumber(point.y)}`
}

const formatNumber = (value: number) => {
  return String(
    Math.round(value * COLLISION_KEY_PRECISION) / COLLISION_KEY_PRECISION,
  )
}
