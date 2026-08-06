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

/**
 * A five-segment elbow has two equal-length choices for its middle transition.
 * Moving that transition can expose a simpler downstream detour without adding
 * bends or length to the current route.
 */
const generateSimpleElbowTransitionShiftCandidates = ({
  initialTrace,
  labelBounds,
  paddedLabelBounds,
}: {
  initialTrace: SolvedTracePath
  labelBounds: { minX: number; minY: number; maxX: number; maxY: number }
  paddedLabelBounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
}): Point[][] => {
  const path = initialTrace.tracePath
  const start = path[0]
  const end = path[path.length - 1]
  if (!start || !end || !isSimpleFiveSegmentElbow(path)) return []

  const candidates: Point[][] = []
  const transitionSegmentIndex = 2

  for (let segmentIndex = 0; segmentIndex < path.length - 1; segmentIndex++) {
    const segmentStart = path[segmentIndex]!
    const segmentEnd = path[segmentIndex + 1]!
    if (!segmentIntersectsRect(segmentStart, segmentEnd, labelBounds)) continue

    const collidingSegmentIsHorizontal = isHorizontal(segmentStart, segmentEnd)
    const collidingSegmentIsVertical = isVertical(segmentStart, segmentEnd)
    if (!collidingSegmentIsHorizontal && !collidingSegmentIsVertical) continue
    if (Math.abs(segmentIndex - transitionSegmentIndex) !== 1) continue

    const axis = collidingSegmentIsHorizontal ? "x" : "y"
    const min = collidingSegmentIsHorizontal
      ? paddedLabelBounds.minX
      : paddedLabelBounds.minY
    const max = collidingSegmentIsHorizontal
      ? paddedLabelBounds.maxX
      : paddedLabelBounds.maxY
    const startCoordinate = collidingSegmentIsHorizontal ? start.x : start.y
    const endCoordinate = collidingSegmentIsHorizontal ? end.x : end.y
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

    const transitionStart = path[transitionSegmentIndex]!
    const transitionEnd = path[transitionSegmentIndex + 1]!
    if (
      (axis === "x" && !isVertical(transitionStart, transitionEnd)) ||
      (axis === "y" && !isHorizontal(transitionStart, transitionEnd))
    ) {
      continue
    }

    for (const coordinate of new Set(corridorCoordinates)) {
      const shiftedPath = shiftSegmentOrth(
        path,
        transitionSegmentIndex,
        axis,
        coordinate,
      )
      if (shiftedPath) candidates.push(shiftedPath)
    }
  }

  return candidates
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

  const transitionShiftCandidates =
    generateSimpleElbowTransitionShiftCandidates({
      initialTrace,
      labelBounds,
      paddedLabelBounds,
    })

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

  return [
    ...transitionShiftCandidates,
    ...fourPointCandidates,
    ...snipReconnectCandidates,
  ]
}
