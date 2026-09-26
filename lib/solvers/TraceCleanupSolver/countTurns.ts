import type { Point } from "@tscircuit/math-utils"

const EPS = 1e-6

export const countTurns = (points: Point[]): number => {
  let turns = 0
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]

    const prevVertical = Math.abs(prev.x - curr.x) < EPS
    const nextVertical = Math.abs(curr.x - next.x) < EPS

    if (prevVertical !== nextVertical) {
      turns++
    }
  }
  return turns
}
