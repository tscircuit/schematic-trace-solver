import type { Bounds, Point } from "@tscircuit/math-utils"
import type { LShape } from "./findAllLShapedTurns"
import type { Rectangle } from "./generateRectangleCandidates"
import type { SolvedTracePath } from "../../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "../simplifyPath"

const EPS = 1e-6

/**
 * Checks if a segment defined by two points is vertical.
 * It considers a segment vertical if the absolute difference between their x-coordinates is less than a small epsilon.
 */
const isVertical = (a: Point, b: Point, eps = EPS) => Math.abs(a.x - b.x) < eps

/**
 * Generates candidate reroutes for an L-shaped turn within a given rectangular area.
 * This function calculates a new path that attempts to smooth out the L-shape by routing around the corner
 * through the provided rectangle, adding padding to avoid immediate collisions.
 * It considers different orientations of the L-shape relative to the rectangle to determine the appropriate rerouting points.
 */
export const generateLShapeRerouteCandidates = ({
  lShape,
  rectangle,
  padding = 0.5,
  interactionPoint1,
  interactionPoint2,
}: {
  lShape: LShape
  rectangle: Rectangle
  padding: number
  interactionPoint1: Point
  interactionPoint2: Point
}): Point[][] => {
  const { p1, p2, p3 } = lShape
  const { x, y, width, height } = rectangle

  let c2: Point
  let i1_padded: Point = interactionPoint1
  let i2_padded: Point = interactionPoint2

  if (Math.abs(p2.x - x) < EPS && Math.abs(p2.y - (y + height)) < EPS) {
    c2 = { x: x + width + padding, y: y - padding }

    if (isVertical(p1, p2)) {
      i1_padded = { x: interactionPoint1.x, y: interactionPoint1.y - padding }
    } else {
      // isHorizontal(p1, p2)
      i1_padded = { x: interactionPoint1.x + padding, y: interactionPoint1.y }
    }
    if (isVertical(p2, p3)) {
      i2_padded = { x: interactionPoint2.x, y: interactionPoint2.y - padding }
    } else {
      // isHorizontal(p2, p3)
      i2_padded = { x: interactionPoint2.x + padding, y: interactionPoint2.y }
    }
  } else if (
    Math.abs(p2.x - (x + width)) < EPS &&
    Math.abs(p2.y - (y + height)) < EPS
  ) {
    c2 = { x: x - padding, y: y - padding }

    if (isVertical(p1, p2)) {
      i1_padded = { x: interactionPoint1.x, y: interactionPoint1.y - padding }
    } else {
      // isHorizontal(p1, p2)
      i1_padded = { x: interactionPoint1.x - padding, y: interactionPoint1.y }
    }
    if (isVertical(p2, p3)) {
      i2_padded = { x: interactionPoint2.x, y: interactionPoint2.y - padding }
    } else {
      // isHorizontal(p2, p3)
      i2_padded = { x: interactionPoint2.x - padding, y: interactionPoint2.y }
    }
  } else if (Math.abs(p2.x - x) < EPS && Math.abs(p2.y - y) < EPS) {
    c2 = { x: x + width + padding, y: y + height + padding }

    if (isVertical(p1, p2)) {
      i1_padded = { x: interactionPoint1.x, y: interactionPoint1.y + padding }
    } else {
      // isHorizontal(p1, p2)
      i1_padded = { x: interactionPoint1.x + padding, y: interactionPoint1.y }
    }
    if (isVertical(p2, p3)) {
      i2_padded = { x: interactionPoint2.x, y: interactionPoint2.y + padding }
    } else {
      // isHorizontal(p2, p3)
      i2_padded = { x: interactionPoint2.x + padding, y: interactionPoint2.y }
    }
  } else if (Math.abs(p2.x - (x + width)) < EPS && Math.abs(p2.y - y) < EPS) {
    c2 = { x: x - padding, y: y + height + padding }

    if (isVertical(p1, p2)) {
      i1_padded = { x: interactionPoint1.x, y: interactionPoint1.y + padding }
    } else {
      // isHorizontal(p1, p2)
      i1_padded = { x: interactionPoint1.x - padding, y: interactionPoint1.y }
    }
    if (isVertical(p2, p3)) {
      i2_padded = { x: interactionPoint2.x, y: interactionPoint2.y + padding }
    } else {
      // isHorizontal(p2, p3)
      i2_padded = { x: interactionPoint2.x - padding, y: interactionPoint2.y }
    }
  } else {
    return []
  }

  return [[i1_padded, c2, i2_padded]]
}

export interface PerpendicularTraceDetourInput {
  trace: SolvedTracePath
  segmentIndex: number
  obstacleStart: Point
  obstacleEnd: Point
  chipBounds: Bounds[]
  clearance: number
}

export interface TraceDetourCandidate {
  traceId: string
  path: Point[]
}

export const generatePerpendicularTraceDetours = ({
  trace,
  segmentIndex,
  obstacleStart,
  obstacleEnd,
  chipBounds,
  clearance,
}: PerpendicularTraceDetourInput): TraceDetourCandidate[] => {
  const buildDetours = (path: Point[], index: number) => {
    const start = path[index]!
    const end = path[index + 1]!
    const movingAxis: "x" | "y" = Math.abs(start.x - end.x) < EPS ? "y" : "x"
    const detourAxis = movingAxis === "x" ? "y" : "x"
    const gate =
      obstacleStart[movingAxis] +
      Math.sign(start[movingAxis] - obstacleStart[movingAxis]) * clearance
    const obstacleRange = [obstacleStart[detourAxis], obstacleEnd[detourAxis]]
    const lowBound = detourAxis === "x" ? "minX" : "minY"
    const highBound = detourAxis === "x" ? "maxX" : "maxY"
    const detourCoordinates = [
      Math.min(...obstacleRange) - clearance,
      Math.max(...obstacleRange) + clearance,
      ...chipBounds.flatMap((bounds) => [
        bounds[lowBound] - clearance,
        bounds[highBound] + clearance,
      ]),
    ]

    return [...new Set(detourCoordinates)].map((detour) =>
      simplifyPath([
        ...path.slice(0, index + 1),
        { ...start, [movingAxis]: gate },
        { ...start, [movingAxis]: gate, [detourAxis]: detour },
        { ...end, [detourAxis]: detour },
        ...path.slice(index + 2),
      ]),
    )
  }

  const reversedPath = [...trace.tracePath].reverse()
  const reversedIndex = trace.tracePath.length - 2 - segmentIndex
  return [
    ...buildDetours(trace.tracePath, segmentIndex),
    ...buildDetours(reversedPath, reversedIndex).map((path) => path.reverse()),
  ].map((path) => ({ traceId: trace.mspPairId, path }))
}
