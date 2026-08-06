import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import { findTraceViolationZone } from "./violation"
import { generateSnipAndReconnectCandidates } from "./trySnipAndReconnect"
import { generateFourPointDetourCandidates } from "./tryFourPointDetour"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"
import {
  isHorizontal,
  isVertical,
  segmentIntersectsRect,
} from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { shiftSegmentOrth } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/pathOps"
import { detectTraceLabelOverlap } from "./detectTraceLabelOverlap"

const isSimpleFiveSegmentElbow = (path: Point[]): boolean => {
  const simplifiedPath = simplifyPath(path)
  if (simplifiedPath.length !== 6) return false

  const segmentIsHorizontal = simplifiedPath
    .slice(0, -1)
    .map((point, index) => isHorizontal(point, simplifiedPath[index + 1]!))

  return segmentIsHorizontal.every(
    (isHorizontalSegment, index) =>
      index === 0 || isHorizontalSegment !== segmentIsHorizontal[index - 1],
  )
}

/**
 * A five-segment elbow can avoid a label by shifting the colliding segment to
 * the nearest padded edge. This keeps the existing number of bends instead of
 * inserting a local four-point notch into the segment.
 */
const generateSimpleElbowSegmentShiftCandidates = ({
  trace,
  label,
  paddingBuffer,
  detourCount,
}: {
  trace: SolvedTracePath
  label: NetLabelPlacement
  paddingBuffer: number
  detourCount: number
}): Point[][] => {
  if (trace.globalConnNetId === label.globalConnNetId) return []

  const path = simplifyPath(trace.tracePath)
  if (!isSimpleFiveSegmentElbow(path)) return []

  const labelBounds = getRectBounds(label.center, label.width, label.height)
  const effectivePadding = paddingBuffer + detourCount * paddingBuffer
  const paddedLabelBounds = {
    minX: labelBounds.minX - effectivePadding,
    maxX: labelBounds.maxX + effectivePadding,
    minY: labelBounds.minY - effectivePadding,
    maxY: labelBounds.maxY + effectivePadding,
  }

  const candidates: Point[][] = []

  for (let segmentIndex = 1; segmentIndex < path.length - 2; segmentIndex++) {
    const segmentStart = path[segmentIndex]!
    const segmentEnd = path[segmentIndex + 1]!
    if (!segmentIntersectsRect(segmentStart, segmentEnd, labelBounds)) continue

    const isHorizontalSegment = isHorizontal(segmentStart, segmentEnd)
    const isVerticalSegment = isVertical(segmentStart, segmentEnd)
    if (!isHorizontalSegment && !isVerticalSegment) continue

    const axis = isHorizontalSegment ? "y" : "x"
    const coordinates = isHorizontalSegment
      ? [paddedLabelBounds.minY, paddedLabelBounds.maxY]
      : [paddedLabelBounds.minX, paddedLabelBounds.maxX]

    for (const coordinate of coordinates) {
      const shiftedPath = shiftSegmentOrth(path, segmentIndex, axis, coordinate)
      if (shiftedPath) candidates.push(shiftedPath)
    }
  }

  return candidates
}

const generateSimpleElbowTransitionShiftCandidates = ({
  trace,
  label,
  paddingBuffer,
  detourCount,
}: {
  trace: SolvedTracePath
  label: NetLabelPlacement
  paddingBuffer: number
  detourCount: number
}): Point[][] => {
  const path = simplifyPath(trace.tracePath)
  if (!isSimpleFiveSegmentElbow(path)) return []

  const labelBounds = getRectBounds(label.center, label.width, label.height)
  const effectivePadding = paddingBuffer + detourCount * paddingBuffer
  const paddedLabelBounds = {
    minX: labelBounds.minX - effectivePadding,
    maxX: labelBounds.maxX + effectivePadding,
    minY: labelBounds.minY - effectivePadding,
    maxY: labelBounds.maxY + effectivePadding,
  }
  const start = path[0]!
  const end = path[path.length - 1]!
  const middleSegmentIndex = 2
  const candidates: Point[][] = []

  for (let segmentIndex = 0; segmentIndex < path.length - 1; segmentIndex++) {
    const segmentStart = path[segmentIndex]!
    const segmentEnd = path[segmentIndex + 1]!
    if (!segmentIntersectsRect(segmentStart, segmentEnd, labelBounds)) continue
    if (Math.abs(segmentIndex - middleSegmentIndex) !== 1) continue

    const isHorizontalSegment = isHorizontal(segmentStart, segmentEnd)
    const isVerticalSegment = isVertical(segmentStart, segmentEnd)
    if (!isHorizontalSegment && !isVerticalSegment) continue

    const axis = isHorizontalSegment ? "x" : "y"
    const min = isHorizontalSegment
      ? paddedLabelBounds.minX
      : paddedLabelBounds.minY
    const max = isHorizontalSegment
      ? paddedLabelBounds.maxX
      : paddedLabelBounds.maxY
    const startCoordinate = isHorizontalSegment ? start.x : start.y
    const endCoordinate = isHorizontalSegment ? end.x : end.y
    const corridorCoordinates: number[] = []

    if (startCoordinate < min) {
      corridorCoordinates.push((startCoordinate + min) / 2)
    } else if (startCoordinate > max) {
      corridorCoordinates.push((startCoordinate + max) / 2)
    }
    if (endCoordinate < min) {
      corridorCoordinates.push((endCoordinate + min) / 2)
    } else if (endCoordinate > max) {
      corridorCoordinates.push((endCoordinate + max) / 2)
    }

    for (const coordinate of new Set(corridorCoordinates)) {
      const shiftedPath = shiftSegmentOrth(
        path,
        middleSegmentIndex,
        axis,
        coordinate,
      )
      if (shiftedPath) candidates.push(shiftedPath)
    }
  }

  return candidates
}

export const generateSimpleElbowDetourCandidates = ({
  trace,
  label,
  netLabelPlacements,
  paddingBuffer,
  detourCount,
}: {
  trace: SolvedTracePath
  label: NetLabelPlacement
  netLabelPlacements: NetLabelPlacement[]
  paddingBuffer: number
  detourCount: number
}): Point[][] => {
  const transitionCandidates = generateSimpleElbowTransitionShiftCandidates({
    trace,
    label,
    paddingBuffer,
    detourCount,
  })
  const combinedCandidates = transitionCandidates.flatMap((tracePath) => {
    const shiftedTrace = { ...trace, tracePath }
    const shiftedOverlaps = detectTraceLabelOverlap({
      traces: [shiftedTrace],
      netLabels: netLabelPlacements,
    })

    return shiftedOverlaps.flatMap(({ label: shiftedLabel }) =>
      generateSimpleElbowSegmentShiftCandidates({
        trace: shiftedTrace,
        label: shiftedLabel,
        paddingBuffer,
        detourCount,
      }),
    )
  })

  return combinedCandidates
}

/**
 * Generates a list of candidate rerouted paths for a given trace that is
 * colliding with a net label.
 *
 * This function employs multiple strategies to propose alternative paths:
 * 1.  **Four-Point Detour:** Creates a rectangular detour around the label.
 * 2.  **Snip and Reconnect:** Attempts to remove the colliding segment and
 *     reconnect the trace around the obstacle.
 *
 * The candidates are generated with increasing padding based on `detourCount`
 * to explore progressively wider detours.
 */
export const generateRerouteCandidates = ({
  trace,
  label,
  paddingBuffer,
  detourCount,
}: {
  trace: SolvedTracePath
  label: NetLabelPlacement
  problem: InputProblem
  paddingBuffer: number
  detourCount: number
}): Point[][] => {
  const initialTrace = { ...trace, tracePath: simplifyPath(trace.tracePath) }

  if (trace.globalConnNetId === label.globalConnNetId) {
    return [initialTrace.tracePath]
  }

  const labelBoundsRaw = getRectBounds(label.center, label.width, label.height)
  const labelBounds = {
    minX: labelBoundsRaw.minX,
    minY: labelBoundsRaw.minY,
    maxX: labelBoundsRaw.maxX,
    maxY: labelBoundsRaw.maxY,
    chipId: `netlabel-${label.netId}`,
  }

  const fourPointCandidates = generateFourPointDetourCandidates({
    initialTrace,
    label,
    labelBounds,
    paddingBuffer,
    detourCount,
  })

  const effectivePadding = paddingBuffer + detourCount * paddingBuffer
  const paddedLabelBounds = {
    minX: labelBounds.minX - effectivePadding,
    maxX: labelBounds.maxX + effectivePadding,
    minY: labelBounds.minY - effectivePadding,
    maxY: labelBounds.maxY + effectivePadding,
  }

  const { firstInsideIndex, lastInsideIndex } = findTraceViolationZone({
    path: initialTrace.tracePath,
    labelBounds,
    paddedBounds: paddedLabelBounds,
  })

  const snipReconnectCandidates = generateSnipAndReconnectCandidates({
    initialTrace,
    firstInsideIndex,
    lastInsideIndex,
    labelBounds,
    paddingBuffer,
    detourCount,
  })

  return [...fourPointCandidates, ...snipReconnectCandidates]
}
