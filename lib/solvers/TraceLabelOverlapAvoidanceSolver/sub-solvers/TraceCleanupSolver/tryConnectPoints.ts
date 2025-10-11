import type { Point } from "@tscircuit/math-utils"

export const tryConnectPoints = (start: Point, end: Point): Point[][] => {
  const candidates: Point[][] = []

  if (start.x === end.x || start.y === end.y) {
    candidates.push([start, end])
  } else {
    candidates.push([start, { x: end.x, y: start.y }, end])
    candidates.push([start, { x: start.x, y: end.y }, end])
  }

  return candidates
}
