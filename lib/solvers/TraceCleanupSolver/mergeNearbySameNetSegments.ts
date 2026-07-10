import type { Point } from "@tscircuit/math-utils"
import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { simplifyPath } from "./simplifyPath"

type SegmentOrientation = "horizontal" | "vertical"

type SegmentRef = {
  traceIndex: number
  startIndex: number
  orientation: SegmentOrientation
  axis: number
  min: number
  max: number
  length: number
  movable: boolean
}

export interface MergeNearbySameNetSegmentsOptions {
  inputProblem?: InputProblem
  allLabelPlacements?: NetLabelPlacement[]
  mergedLabelNetIdMap?: Record<string, Set<string>>
  axisTolerance?: number
  gapTolerance?: number
  maxPasses?: number
}

const EPSILON = 1e-6
const DEFAULT_AXIS_TOLERANCE = 0.1
const DEFAULT_GAP_TOLERANCE = 0.2
const DEFAULT_MAX_PASSES = 50

const getNetKey = (trace: SolvedTracePath) =>
  trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId

const getOrientation = (
  startPoint: Point,
  endPoint: Point,
): SegmentOrientation | null => {
  if (
    Math.abs(startPoint.y - endPoint.y) < EPSILON &&
    Math.abs(startPoint.x - endPoint.x) >= EPSILON
  ) {
    return "horizontal"
  }

  if (
    Math.abs(startPoint.x - endPoint.x) < EPSILON &&
    Math.abs(startPoint.y - endPoint.y) >= EPSILON
  ) {
    return "vertical"
  }

  return null
}

const getSegments = (traces: SolvedTracePath[]): SegmentRef[] => {
  const segments: SegmentRef[] = []

  for (const [traceIndex, trace] of traces.entries()) {
    for (
      let startIndex = 0;
      startIndex < trace.tracePath.length - 1;
      startIndex++
    ) {
      const startPoint = trace.tracePath[startIndex]!
      const endPoint = trace.tracePath[startIndex + 1]!
      const orientation = getOrientation(startPoint, endPoint)
      if (!orientation) continue

      const horizontal = orientation === "horizontal"
      const start = horizontal ? startPoint.x : startPoint.y
      const end = horizontal ? endPoint.x : endPoint.y

      segments.push({
        traceIndex,
        startIndex,
        orientation,
        axis: horizontal ? startPoint.y : startPoint.x,
        min: Math.min(start, end),
        max: Math.max(start, end),
        length: Math.abs(end - start),
        movable: startIndex > 0 && startIndex + 1 < trace.tracePath.length - 1,
      })
    }
  }

  return segments
}

const getIntervalGap = (first: SegmentRef, second: SegmentRef) => {
  if (first.max >= second.min && second.max >= first.min) return 0
  return Math.min(
    Math.abs(first.max - second.min),
    Math.abs(second.max - first.min),
  )
}

const getAffectedSegmentIndexes = (segment: SegmentRef) =>
  [segment.startIndex - 1, segment.startIndex, segment.startIndex + 1].filter(
    (index) => index >= 0,
  )

const moveSegmentInPath = (
  path: Point[],
  segment: SegmentRef,
  targetAxis: number,
) => {
  const startPoint = path[segment.startIndex]!
  const endPoint = path[segment.startIndex + 1]!

  if (segment.orientation === "horizontal") {
    startPoint.y = targetAxis
    endPoint.y = targetAxis
  } else {
    startPoint.x = targetAxis
    endPoint.x = targetAxis
  }
}

const rangesOverlap = (
  firstMin: number,
  firstMax: number,
  secondMin: number,
  secondMax: number,
) => Math.min(firstMax, secondMax) - Math.max(firstMin, secondMin) > EPSILON

const axisAlignedSegmentsIntersect = (
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
) => {
  const firstOrientation = getOrientation(firstStart, firstEnd)
  const secondOrientation = getOrientation(secondStart, secondEnd)
  if (!firstOrientation || !secondOrientation) return false

  if (firstOrientation === secondOrientation) {
    if (firstOrientation === "horizontal") {
      return (
        Math.abs(firstStart.y - secondStart.y) < EPSILON &&
        rangesOverlap(
          Math.min(firstStart.x, firstEnd.x),
          Math.max(firstStart.x, firstEnd.x),
          Math.min(secondStart.x, secondEnd.x),
          Math.max(secondStart.x, secondEnd.x),
        )
      )
    }

    return (
      Math.abs(firstStart.x - secondStart.x) < EPSILON &&
      rangesOverlap(
        Math.min(firstStart.y, firstEnd.y),
        Math.max(firstStart.y, firstEnd.y),
        Math.min(secondStart.y, secondEnd.y),
        Math.max(secondStart.y, secondEnd.y),
      )
    )
  }

  const horizontal =
    firstOrientation === "horizontal"
      ? { start: firstStart, end: firstEnd }
      : { start: secondStart, end: secondEnd }
  const vertical =
    firstOrientation === "vertical"
      ? { start: firstStart, end: firstEnd }
      : { start: secondStart, end: secondEnd }

  const horizontalMinX = Math.min(horizontal.start.x, horizontal.end.x)
  const horizontalMaxX = Math.max(horizontal.start.x, horizontal.end.x)
  const verticalMinY = Math.min(vertical.start.y, vertical.end.y)
  const verticalMaxY = Math.max(vertical.start.y, vertical.end.y)

  return (
    vertical.start.x > horizontalMinX + EPSILON &&
    vertical.start.x < horizontalMaxX - EPSILON &&
    horizontal.start.y > verticalMinY + EPSILON &&
    horizontal.start.y < verticalMaxY - EPSILON
  )
}

const getLabelBounds = (
  trace: SolvedTracePath,
  allLabelPlacements: NetLabelPlacement[],
  mergedLabelNetIdMap: Record<string, Set<string>>,
) =>
  allLabelPlacements
    .filter((label) => {
      const originalNetIds = mergedLabelNetIdMap[label.globalConnNetId]
      if (originalNetIds?.has(trace.globalConnNetId)) return false
      return label.globalConnNetId !== trace.globalConnNetId
    })
    .map((label) => ({
      minX: label.center.x - label.width / 2 + EPSILON,
      maxX: label.center.x + label.width / 2 - EPSILON,
      minY: label.center.y - label.height / 2 + EPSILON,
      maxY: label.center.y + label.height / 2 - EPSILON,
    }))

const canMoveSegmentToAxis = (
  traces: SolvedTracePath[],
  segment: SegmentRef,
  targetAxis: number,
  options: MergeNearbySameNetSegmentsOptions,
) => {
  const trace = traces[segment.traceIndex]!
  const candidatePath = trace.tracePath.map((point) => ({ ...point }))
  moveSegmentInPath(candidatePath, segment, targetAxis)

  const affectedSegmentIndexes = getAffectedSegmentIndexes(segment).filter(
    (index) => index < candidatePath.length - 1,
  )

  const staticObstacles = options.inputProblem
    ? getObstacleRects(options.inputProblem).map((obstacle) => ({
        ...obstacle,
        minX: obstacle.minX + EPSILON,
        maxX: obstacle.maxX - EPSILON,
        minY: obstacle.minY + EPSILON,
        maxY: obstacle.maxY - EPSILON,
      }))
    : []
  const labelBounds = getLabelBounds(
    trace,
    options.allLabelPlacements ?? [],
    options.mergedLabelNetIdMap ?? {},
  )

  for (const affectedIndex of affectedSegmentIndexes) {
    const startPoint = candidatePath[affectedIndex]!
    const endPoint = candidatePath[affectedIndex + 1]!

    if (
      staticObstacles.some((obstacle) =>
        segmentIntersectsRect(startPoint, endPoint, obstacle),
      ) ||
      labelBounds.some((bounds) =>
        segmentIntersectsRect(startPoint, endPoint, bounds),
      )
    ) {
      return false
    }

    for (const otherTrace of traces) {
      if (getNetKey(otherTrace) === getNetKey(trace)) continue

      for (
        let otherIndex = 0;
        otherIndex < otherTrace.tracePath.length - 1;
        otherIndex++
      ) {
        if (
          axisAlignedSegmentsIntersect(
            startPoint,
            endPoint,
            otherTrace.tracePath[otherIndex]!,
            otherTrace.tracePath[otherIndex + 1]!,
          )
        ) {
          return false
        }
      }
    }
  }

  return true
}

const chooseTargetAndMovingSegment = (
  first: SegmentRef,
  second: SegmentRef,
): { target: SegmentRef; moving: SegmentRef } | null => {
  if (!first.movable && !second.movable) return null
  if (!first.movable) return { target: first, moving: second }
  if (!second.movable) return { target: second, moving: first }
  if (first.length > second.length) return { target: first, moving: second }
  if (second.length > first.length) return { target: second, moving: first }

  return first.traceIndex < second.traceIndex ||
    (first.traceIndex === second.traceIndex &&
      first.startIndex < second.startIndex)
    ? { target: first, moving: second }
    : { target: second, moving: first }
}

export const mergeNearbySameNetSegments = (
  traces: SolvedTracePath[],
  options: MergeNearbySameNetSegmentsOptions = {},
): { traces: SolvedTracePath[]; mergedSegmentCount: number } => {
  const axisTolerance = options.axisTolerance ?? DEFAULT_AXIS_TOLERANCE
  const gapTolerance = options.gapTolerance ?? DEFAULT_GAP_TOLERANCE
  const maxPasses = options.maxPasses ?? DEFAULT_MAX_PASSES

  if (axisTolerance < 0 || gapTolerance < 0 || maxPasses < 1) {
    throw new Error("Merge tolerances must be non-negative and maxPasses >= 1")
  }

  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  let mergedSegmentCount = 0

  for (let pass = 0; pass < maxPasses; pass++) {
    const segments = getSegments(outputTraces)
    let changedThisPass = false

    search: for (
      let firstIndex = 0;
      firstIndex < segments.length;
      firstIndex++
    ) {
      const first = segments[firstIndex]!
      const firstTrace = outputTraces[first.traceIndex]!
      const firstNetKey = getNetKey(firstTrace)
      if (!firstNetKey) continue

      for (
        let secondIndex = firstIndex + 1;
        secondIndex < segments.length;
        secondIndex++
      ) {
        const second = segments[secondIndex]!
        const secondTrace = outputTraces[second.traceIndex]!

        if (
          first.traceIndex === second.traceIndex &&
          Math.min(first.length, second.length) < gapTolerance
        ) {
          continue
        }
        if (first.orientation !== second.orientation) continue
        if (firstNetKey !== getNetKey(secondTrace)) continue
        const axisDistance = Math.abs(first.axis - second.axis)
        if (axisDistance < EPSILON || axisDistance > axisTolerance) continue
        if (getIntervalGap(first, second) > gapTolerance) continue

        const selected = chooseTargetAndMovingSegment(first, second)
        if (!selected) continue
        if (
          !canMoveSegmentToAxis(
            outputTraces,
            selected.moving,
            selected.target.axis,
            options,
          )
        ) {
          continue
        }

        moveSegmentInPath(
          outputTraces[selected.moving.traceIndex]!.tracePath,
          selected.moving,
          selected.target.axis,
        )
        outputTraces[selected.moving.traceIndex]!.tracePath = simplifyPath(
          outputTraces[selected.moving.traceIndex]!.tracePath,
        )
        mergedSegmentCount++
        changedThisPass = true
        break search
      }
    }

    if (!changedThisPass) break
  }

  return { traces: outputTraces, mergedSegmentCount }
}
