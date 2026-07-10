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
  fixedAxis: number
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
const DEFAULT_MAX_PASSES = 4

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

const getSegmentRefs = (traces: SolvedTracePath[]): SegmentRef[] => {
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
        fixedAxis: horizontal ? startPoint.y : startPoint.x,
        min: Math.min(start, end),
        max: Math.max(start, end),
        length: Math.abs(start - end),
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

const getMovedPoints = (
  trace: SolvedTracePath,
  segment: SegmentRef,
  targetAxis: number,
) => {
  const startPoint = { ...trace.tracePath[segment.startIndex]! }
  const endPoint = { ...trace.tracePath[segment.startIndex + 1]! }

  if (segment.orientation === "horizontal") {
    startPoint.y = targetAxis
    endPoint.y = targetAxis
  } else {
    startPoint.x = targetAxis
    endPoint.x = targetAxis
  }

  return { startPoint, endPoint }
}

const getMovedSegment = (
  trace: SolvedTracePath,
  segment: SegmentRef,
  targetAxis: number,
): SegmentRef => {
  const { startPoint, endPoint } = getMovedPoints(trace, segment, targetAxis)

  return {
    ...segment,
    fixedAxis: targetAxis,
    min:
      segment.orientation === "horizontal"
        ? Math.min(startPoint.x, endPoint.x)
        : Math.min(startPoint.y, endPoint.y),
    max:
      segment.orientation === "horizontal"
        ? Math.max(startPoint.x, endPoint.x)
        : Math.max(startPoint.y, endPoint.y),
  }
}

const moveSegmentToAxis = (
  traces: SolvedTracePath[],
  segment: SegmentRef,
  targetAxis: number,
) => {
  const trace = traces[segment.traceIndex]!
  const startPoint = trace.tracePath[segment.startIndex]!
  const endPoint = trace.tracePath[segment.startIndex + 1]!

  if (segment.orientation === "horizontal") {
    startPoint.y = targetAxis
    endPoint.y = targetAxis
  } else {
    startPoint.x = targetAxis
    endPoint.x = targetAxis
  }
}

const rangesOverlap = (first: SegmentRef, second: SegmentRef) =>
  Math.min(first.max, second.max) - Math.max(first.min, second.min) > EPSILON

const segmentRefsCollide = (first: SegmentRef, second: SegmentRef) => {
  if (first.orientation === second.orientation) {
    return (
      Math.abs(first.fixedAxis - second.fixedAxis) < EPSILON &&
      rangesOverlap(first, second)
    )
  }

  const horizontal = first.orientation === "horizontal" ? first : second
  const vertical = first.orientation === "vertical" ? first : second

  return (
    vertical.fixedAxis > horizontal.min + EPSILON &&
    vertical.fixedAxis < horizontal.max - EPSILON &&
    horizontal.fixedAxis > vertical.min + EPSILON &&
    horizontal.fixedAxis < vertical.max - EPSILON
  )
}

const getDifferentNetLabelBounds = (
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
  const movedSegment = getMovedSegment(trace, segment, targetAxis)
  const { startPoint, endPoint } = getMovedPoints(trace, segment, targetAxis)
  const netKey = getNetKey(trace)

  for (const otherSegment of getSegmentRefs(traces)) {
    if (
      otherSegment.traceIndex === segment.traceIndex &&
      otherSegment.startIndex === segment.startIndex
    ) {
      continue
    }

    const otherTrace = traces[otherSegment.traceIndex]!
    if (getNetKey(otherTrace) === netKey) continue
    if (segmentRefsCollide(movedSegment, otherSegment)) return false
  }

  if (options.inputProblem) {
    const intersectsObstacle = getObstacleRects(options.inputProblem).some(
      (obstacle) =>
        segmentIntersectsRect(startPoint, endPoint, {
          ...obstacle,
          minX: obstacle.minX + EPSILON,
          maxX: obstacle.maxX - EPSILON,
          minY: obstacle.minY + EPSILON,
          maxY: obstacle.maxY - EPSILON,
        }),
    )
    if (intersectsObstacle) return false
  }

  const intersectsLabel = getDifferentNetLabelBounds(
    trace,
    options.allLabelPlacements ?? [],
    options.mergedLabelNetIdMap ?? {},
  ).some((bounds) => segmentIntersectsRect(startPoint, endPoint, bounds))

  return !intersectsLabel
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
    let changedThisPass = false
    const segments = getSegmentRefs(outputTraces)

    for (let firstIndex = 0; firstIndex < segments.length; firstIndex++) {
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

        if (first.traceIndex === second.traceIndex) continue
        if (first.orientation !== second.orientation) continue
        if (firstNetKey !== getNetKey(secondTrace)) continue
        const axisDistance = Math.abs(first.fixedAxis - second.fixedAxis)
        if (axisDistance < EPSILON || axisDistance > axisTolerance) continue
        if (getIntervalGap(first, second) > gapTolerance) continue
        if (!first.movable && !second.movable) continue

        if (!first.movable) {
          if (
            !canMoveSegmentToAxis(
              outputTraces,
              second,
              first.fixedAxis,
              options,
            )
          ) {
            continue
          }
          moveSegmentToAxis(outputTraces, second, first.fixedAxis)
        } else if (!second.movable) {
          if (
            !canMoveSegmentToAxis(
              outputTraces,
              first,
              second.fixedAxis,
              options,
            )
          ) {
            continue
          }
          moveSegmentToAxis(outputTraces, first, second.fixedAxis)
        } else if (first.length === second.length) {
          const targetAxis = (first.fixedAxis + second.fixedAxis) / 2
          if (
            !canMoveSegmentToAxis(outputTraces, first, targetAxis, options) ||
            !canMoveSegmentToAxis(outputTraces, second, targetAxis, options)
          ) {
            continue
          }
          moveSegmentToAxis(outputTraces, first, targetAxis)
          moveSegmentToAxis(outputTraces, second, targetAxis)
        } else if (first.length > second.length) {
          if (
            !canMoveSegmentToAxis(
              outputTraces,
              second,
              first.fixedAxis,
              options,
            )
          ) {
            continue
          }
          moveSegmentToAxis(outputTraces, second, first.fixedAxis)
        } else {
          if (
            !canMoveSegmentToAxis(
              outputTraces,
              first,
              second.fixedAxis,
              options,
            )
          ) {
            continue
          }
          moveSegmentToAxis(outputTraces, first, second.fixedAxis)
        }

        mergedSegmentCount++
        changedThisPass = true
      }
    }

    for (const trace of outputTraces) {
      trace.tracePath = simplifyPath(trace.tracePath)
    }

    if (!changedThisPass) break
  }

  return { traces: outputTraces, mergedSegmentCount }
}
