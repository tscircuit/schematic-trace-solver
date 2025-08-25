import type { Point } from "@tscircuit/math-utils"
import type { Guideline } from "lib/solvers/GuidelinesSolver/GuidelinesSolver"
import { dir, type FacingDirection } from "lib/utils/dir"

export interface MovableSegment {
  start: Point
  end: Point
  freedom: "x+" | "x-" | "y+" | "y-"
  dir: { x: number; y: number }
}

export const generateElbowVariants = ({
  baseElbow,
  guidelines,
}: {
  baseElbow: Point[]
  guidelines: Guideline[]
}): {
  elbowVariants: Array<Point[]>
  movableSegments: Array<MovableSegment>
} => {
  // First we find the movable segments, movable segments are the any segments
  // of the baseElbow that are not the first or last segment
  const movableSegments: Array<MovableSegment> = []
  for (let i = 1; i < baseElbow.length - 2; i++) {
    const prev = baseElbow[i - 1]
    const start = baseElbow[i]
    const end = baseElbow[i + 1]

    const isHorz = Math.abs(start.y - end.y) < 1e-6

    let freedom: FacingDirection
    if (isHorz) {
      freedom = prev.y <= start.y ? "y+" : "y-"
    } else {
      freedom = prev.x <= start.x ? "x+" : "x-"
    }

    movableSegments.push({ start, end, freedom, dir: dir(freedom) })
  }
  console.log(movableSegments)

  // We consider

  return {
    elbowVariants: [],
    movableSegments,
  }
}
