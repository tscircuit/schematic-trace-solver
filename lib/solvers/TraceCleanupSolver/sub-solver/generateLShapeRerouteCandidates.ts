import type { Point } from "@tscircuit/math-utils"
import type { LShape } from "./findAllLShapedTurns"
import type { Rectangle } from "./generateRectangleCandidates"

const EPS = 1e-6

const isVertical = (a: Point, b: Point, eps = EPS) => Math.abs(a.x - b.x) < eps

export const generateLShapeRerouteCandidates = (
  lShape: LShape,
  rectangle: Rectangle,
  padding = 0.5,
  i1: Point,
  i2: Point,
): Point[][] => {
  const { p1, p2, p3 } = lShape
  const { x, y, width, height } = rectangle

  let c2: Point
  let i1_padded: Point = i1
  let i2_padded: Point = i2

  if (Math.abs(p2.x - x) < EPS && Math.abs(p2.y - (y + height)) < EPS) {
    c2 = { x: x + width + padding, y: y - padding }

    if (isVertical(p1, p2)) {
      i1_padded = { x: i1.x, y: i1.y - padding }
    } else {
      // isHorizontal(p1, p2)
      i1_padded = { x: i1.x + padding, y: i1.y }
    }
    if (isVertical(p2, p3)) {
      i2_padded = { x: i2.x, y: i2.y - padding }
    } else {
      // isHorizontal(p2, p3)
      i2_padded = { x: i2.x + padding, y: i2.y }
    }
  } else if (
    Math.abs(p2.x - (x + width)) < EPS &&
    Math.abs(p2.y - (y + height)) < EPS
  ) {
    c2 = { x: x - padding, y: y - padding }

    if (isVertical(p1, p2)) {
      i1_padded = { x: i1.x, y: i1.y - padding }
    } else {
      // isHorizontal(p1, p2)
      i1_padded = { x: i1.x - padding, y: i1.y }
    }
    if (isVertical(p2, p3)) {
      i2_padded = { x: i2.x, y: i2.y - padding }
    } else {
      // isHorizontal(p2, p3)
      i2_padded = { x: i2.x - padding, y: i2.y }
    }
  } else if (Math.abs(p2.x - x) < EPS && Math.abs(p2.y - y) < EPS) {
    c2 = { x: x + width + padding, y: y + height + padding }

    if (isVertical(p1, p2)) {
      i1_padded = { x: i1.x, y: i1.y + padding }
    } else {
      // isHorizontal(p1, p2)
      i1_padded = { x: i1.x + padding, y: i1.y }
    }
    if (isVertical(p2, p3)) {
      i2_padded = { x: i2.x, y: i2.y + padding }
    } else {
      // isHorizontal(p2, p3)
      i2_padded = { x: i2.x + padding, y: i2.y }
    }
  } else if (Math.abs(p2.x - (x + width)) < EPS && Math.abs(p2.y - y) < EPS) {
    c2 = { x: x - padding, y: y + height + padding }

    if (isVertical(p1, p2)) {
      i1_padded = { x: i1.x, y: i1.y + padding }
    } else {
      // isHorizontal(p1, p2)
      i1_padded = { x: i1.x - padding, y: i1.y }
    }
    if (isVertical(p2, p3)) {
      i2_padded = { x: i2.x, y: i2.y + padding }
    } else {
      // isHorizontal(p2, p3)
      i2_padded = { x: i2.x - padding, y: i2.y }
    }
  } else {
    return []
  }

  return [[i1_padded, c2, i2_padded]]
}
