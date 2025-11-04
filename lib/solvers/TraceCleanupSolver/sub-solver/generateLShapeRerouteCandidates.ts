import type { Point } from "@tscircuit/math-utils"
import type { LShape } from "./findAllLShapedTurns"
import type { Rectangle } from "./generateRectangleCandidates"

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
