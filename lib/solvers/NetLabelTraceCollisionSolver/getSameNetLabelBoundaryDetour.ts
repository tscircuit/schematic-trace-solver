import type { Point } from "@tscircuit/math-utils"
import type { FacingDirection } from "lib/utils/dir"
import {
  isYOrientation,
  rangesOverlap,
} from "lib/solvers/AvailableNetOrientationSolver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isPathCollidingWithObstacles,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { RectBounds } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { countPathIntersections } from "lib/solvers/Example28Solver/geometry"

const BOUNDARY_EPSILON = 1e-9

const addPoints = (firstPoint: Point, secondPoint: Point): Point => ({
  x: firstPoint.x + secondPoint.x,
  y: firstPoint.y + secondPoint.y,
})

const getLongSideOutwardOffset = ({
  segmentStart,
  segmentEnd,
  labelBounds,
  labelOrientation,
  clearance,
}: {
  segmentStart: Point
  segmentEnd: Point
  labelBounds: RectBounds
  labelOrientation: FacingDirection
  clearance: number
}): Point | null => {
  const segmentIsVertical = isVertical(segmentStart, segmentEnd)
  const labelIsVertical = isYOrientation(labelOrientation)

  // Only move segments parallel to the label body; its two end caps stay fixed.
  if (segmentIsVertical) {
    if (!labelIsVertical) return null
    if (
      !rangesOverlap(
        Math.min(segmentStart.y, segmentEnd.y),
        Math.max(segmentStart.y, segmentEnd.y),
        labelBounds.minY,
        labelBounds.maxY,
      )
    ) {
      return null
    }
    if (
      Math.abs(segmentStart.x - labelBounds.minX) <
      clearance - BOUNDARY_EPSILON
    ) {
      return { x: labelBounds.minX - clearance - segmentStart.x, y: 0 }
    }
    if (
      Math.abs(segmentStart.x - labelBounds.maxX) <
      clearance - BOUNDARY_EPSILON
    ) {
      return { x: labelBounds.maxX + clearance - segmentStart.x, y: 0 }
    }
    return null
  }

  if (labelIsVertical) return null
  if (
    !rangesOverlap(
      Math.min(segmentStart.x, segmentEnd.x),
      Math.max(segmentStart.x, segmentEnd.x),
      labelBounds.minX,
      labelBounds.maxX,
    )
  ) {
    return null
  }
  if (
    Math.abs(segmentStart.y - labelBounds.minY) <
    clearance - BOUNDARY_EPSILON
  ) {
    return { x: 0, y: labelBounds.minY - clearance - segmentStart.y }
  }
  if (
    Math.abs(segmentStart.y - labelBounds.maxY) <
    clearance - BOUNDARY_EPSILON
  ) {
    return { x: 0, y: labelBounds.maxY + clearance - segmentStart.y }
  }
  return null
}

export const getSameNetLabelBoundaryDetour = ({
  trace,
  label,
  clearance,
  obstacles,
  traces,
}: {
  trace: SolvedTracePath
  label: NetLabelPlacement
  clearance: number
  obstacles: RectBounds[]
  traces: SolvedTracePath[]
}): Point[] | null => {
  if (trace.globalConnNetId !== label.globalConnNetId) return null
  if (!label.mspConnectionPairIds.includes(trace.mspPairId)) return null

  const labelBounds = getRectBounds(label.center, label.width, label.height)

  for (
    let segmentIndex = 0;
    segmentIndex < trace.tracePath.length - 1;
    segmentIndex++
  ) {
    const segmentStart = trace.tracePath[segmentIndex]!
    const segmentEnd = trace.tracePath[segmentIndex + 1]!
    const outwardOffset = getLongSideOutwardOffset({
      segmentStart,
      segmentEnd,
      labelBounds,
      labelOrientation: label.orientation,
      clearance,
    })
    if (!outwardOffset) continue

    const shiftedStart = addPoints(segmentStart, outwardOffset)
    const shiftedEnd = addPoints(segmentEnd, outwardOffset)
    // Drop replaced internal corners so the shifted segment forms clean bends without backtracking.
    const pathBeforeDetour = trace.tracePath.slice(0, segmentIndex)
    const pathAfterDetour = trace.tracePath.slice(segmentIndex + 2)
    if (segmentIndex === 0) pathBeforeDetour.push(segmentStart)
    if (segmentIndex + 1 === trace.tracePath.length - 1) {
      pathAfterDetour.unshift(segmentEnd)
    }
    const detour = [
      ...pathBeforeDetour,
      shiftedStart,
      shiftedEnd,
      ...pathAfterDetour,
    ]

    if (isPathCollidingWithObstacles(detour, obstacles)) return null

    for (const otherTrace of traces) {
      if (otherTrace.globalConnNetId === trace.globalConnNetId) continue
      if (countPathIntersections(detour, otherTrace.tracePath) > 0) return null
    }

    return detour
  }

  return null
}
