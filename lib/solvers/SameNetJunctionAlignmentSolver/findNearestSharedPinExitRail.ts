import type { Point } from "@tscircuit/math-utils"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputPin } from "lib/types/InputProblem"
import { dir } from "lib/utils/dir"

export type Axis = "x" | "y"

export interface AxisAlignedSegment {
  start: Point
  end: Point
  axis: Axis
  coordinate: number
}

export interface SharedPinExitRail {
  segment: AxisAlignedSegment
  sharedPinExit: Point
}

export const getPinFacingAxis = (pin: InputPin): Axis | null => {
  if (!pin._facingDirection) return null
  return dir(pin._facingDirection).x === 0 ? "y" : "x"
}

export const isCoordinateOnPinFacingSide = ({
  coordinate,
  axis,
  pin,
}: {
  coordinate: number
  axis: Axis
  pin: InputPin
}) => {
  if (!pin._facingDirection) return false
  const facingVector = dir(pin._facingDirection)
  return (coordinate - pin[axis]) * facingVector[axis] > 0
}

const getSegmentAxis = (start: Point, end: Point): Axis | null => {
  if (isHorizontal(start, end)) return "x"
  if (isVertical(start, end)) return "y"
  return null
}

const getAxisAlignedSegments = (path: Point[]): AxisAlignedSegment[] => {
  const segments: AxisAlignedSegment[] = []
  for (let index = 0; index < path.length - 1; index++) {
    const start = path[index]!
    const end = path[index + 1]!
    const axis = getSegmentAxis(start, end)
    if (!axis) continue
    const coordinateAxis = axis === "x" ? "y" : "x"
    segments.push({ start, end, axis, coordinate: start[coordinateAxis] })
  }
  return segments
}

const getPinExitPoint = ({
  pin,
  departureAxis,
  railCoordinate,
}: {
  pin: InputPin
  departureAxis: Axis
  railCoordinate: number
}): Point =>
  departureAxis === "x"
    ? { x: railCoordinate, y: pin.y }
    : { x: pin.x, y: railCoordinate }

/**
 * Finds the nearest existing donor rail that joins two same-side pin exits
 * and is already reached by the branch leaving the shared pin.
 */
export const findNearestSharedPinExitRail = ({
  donorPath,
  branchDepartureSegment,
  sharedPin,
  adjacentPin,
}: {
  donorPath: Point[]
  branchDepartureSegment: [Point, Point]
  sharedPin: InputPin
  adjacentPin: InputPin
}): SharedPinExitRail | null => {
  const departureAxis = getPinFacingAxis(sharedPin)
  if (!departureAxis) return null
  const railAxis = departureAxis === "x" ? "y" : "x"

  const branchDeparture = getAxisAlignedSegments(branchDepartureSegment)[0]
  if (!branchDeparture || branchDeparture.axis !== departureAxis) return null

  let nearestRail: SharedPinExitRail | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const segment of getAxisAlignedSegments(donorPath)) {
    if (segment.axis !== railAxis) continue
    if (
      !isCoordinateOnPinFacingSide({
        coordinate: segment.coordinate,
        axis: departureAxis,
        pin: sharedPin,
      })
    ) {
      continue
    }

    const sharedPinExit = getPinExitPoint({
      pin: sharedPin,
      departureAxis,
      railCoordinate: segment.coordinate,
    })
    const adjacentPinExit = getPinExitPoint({
      pin: adjacentPin,
      departureAxis,
      railCoordinate: segment.coordinate,
    })
    if (
      !tracePathContainsPoint([segment.start, segment.end], sharedPinExit) ||
      !tracePathContainsPoint([segment.start, segment.end], adjacentPinExit) ||
      !tracePathContainsPoint(
        [branchDeparture.start, branchDeparture.end],
        sharedPinExit,
      )
    ) {
      continue
    }

    const distance = Math.abs(segment.coordinate - sharedPin[departureAxis])
    if (distance >= nearestDistance) continue
    nearestRail = { segment, sharedPinExit }
    nearestDistance = distance
  }

  return nearestRail
}
