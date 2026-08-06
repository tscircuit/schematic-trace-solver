import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
  segmentIntersectsRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { shiftSegmentOrth } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/pathOps"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"

export const isSimpleFiveSegmentElbow = (path: Point[]): boolean => {
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

const generateSegmentShiftCandidates = ({
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

const generateTransitionShiftCandidates = ({
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

export const generateElbowTransitionSimplificationCandidates = ({
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
  const transitionCandidates = generateTransitionShiftCandidates({
    trace,
    label,
    paddingBuffer,
    detourCount,
  })

  return transitionCandidates.flatMap((tracePath) => {
    const shiftedTrace = { ...trace, tracePath }
    const shiftedOverlaps = detectTraceLabelOverlap({
      traces: [shiftedTrace],
      netLabels: netLabelPlacements,
    })

    return shiftedOverlaps.flatMap(({ label: shiftedLabel }) =>
      generateSegmentShiftCandidates({
        trace: shiftedTrace,
        label: shiftedLabel,
        paddingBuffer,
        detourCount,
      }),
    )
  })
}
