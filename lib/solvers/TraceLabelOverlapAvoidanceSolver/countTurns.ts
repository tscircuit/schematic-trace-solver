import type { Point } from "@tscircuit/math-utils"

export const countTurns = (points: Point[]): number => {
  let turns = 0
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]

    const prevVertical = prev.x === curr.x
    const nextVertical = curr.x === next.x

    if (prevVertical !== nextVertical) {
      turns++
    }
  }
  return turns
}
