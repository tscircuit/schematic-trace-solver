import type { Point } from "@tscircuit/math-utils"
import type { Guideline } from "lib/solvers/GuidelinesSolver/GuidelinesSolver"

export const generateElbowVariants = ({
  baseElbow,
  guidelines,
}: {
  baseElbow: Point[]
  guidelines: Guideline[]
}): {
  elbowVariants: Array<Point[]>
  movableSegments: Array<[Point, Point]>
} => {
  // First we find the movable segments, movable segments are the any segments
  // of the baseElbow that are not the first or last segment
  const movableSegments = []
  console.log("baseElbow", baseElbow)
  for (let i = 1; i < baseElbow.length - 1; i++) {
    const start = baseElbow[i]
    const end = baseElbow[i + 1]
    movableSegments.push([start, end] as [Point, Point])
  }

  return {
    elbowVariants: [],
    movableSegments,
  }
}
