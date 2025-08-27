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
  // First, find movable segments. To keep the polyline orthogonal, only move
  // strictly interior segments whose endpoints are not adjacent to the first
  // or last segment (avoid [P1-P2] and [P(n-3)-P(n-2)]).
  const movableSegments: Array<MovableSegment> = []
  const firstMovableIndex = 2
  const lastMovableIndex = baseElbow.length - 4
  for (let i = firstMovableIndex; i <= lastMovableIndex; i++) {
    if (i < 0 || i + 1 >= baseElbow.length) continue
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

  // Find relevant guidelines for each movable segment
  const segmentGuidelineOptions: Array<Array<number>> = []

  for (const segment of movableSegments) {
    const relevantPositions: number[] = []

    if (segment.freedom === "x+" || segment.freedom === "x-") {
      // Segment can move horizontally, find vertical guidelines
      for (const guideline of guidelines) {
        if (guideline.orientation === "vertical" && guideline.x !== undefined) {
          relevantPositions.push(guideline.x)
        }
      }
      // Add current position as an option (no movement)
      relevantPositions.push(segment.start.x)
    } else {
      // Segment can move vertically, find horizontal guidelines
      for (const guideline of guidelines) {
        if (
          guideline.orientation === "horizontal" &&
          guideline.y !== undefined
        ) {
          relevantPositions.push(guideline.y)
        }
      }
      // Add current position as an option (no movement)
      relevantPositions.push(segment.start.y)
    }

    segmentGuidelineOptions.push(
      [...new Set(relevantPositions)].sort((a, b) => a - b),
    )
  }

  // Generate all combinations of segment positions
  const generateCombinations = (
    options: Array<Array<number>>,
  ): Array<Array<number>> => {
    if (options.length === 0) return [[]]
    if (options.length === 1) return options[0].map((pos) => [pos])

    const combinations: Array<Array<number>> = []
    const firstOptions = options[0]
    const restCombinations = generateCombinations(options.slice(1))

    for (const firstOption of firstOptions) {
      for (const restCombination of restCombinations) {
        combinations.push([firstOption, ...restCombination])
      }
    }

    return combinations
  }

  const positionCombinations = generateCombinations(segmentGuidelineOptions)

  // Create elbow variants by applying each combination
  const elbowVariants: Array<Point[]> = []

  for (const combination of positionCombinations) {
    const variant = [...baseElbow]

    // Apply each segment movement
    for (
      let segmentIndex = 0;
      segmentIndex < movableSegments.length;
      segmentIndex++
    ) {
      const segment = movableSegments[segmentIndex]
      const newPosition = combination[segmentIndex]
      const elbowIndex = segmentIndex + 1 // movable segments start at index 1

      if (segment.freedom === "x+" || segment.freedom === "x-") {
        // Move horizontally
        variant[elbowIndex] = { ...variant[elbowIndex], x: newPosition }
        variant[elbowIndex + 1] = { ...variant[elbowIndex + 1], x: newPosition }
      } else {
        // Move vertically
        variant[elbowIndex] = { ...variant[elbowIndex], y: newPosition }
        variant[elbowIndex + 1] = { ...variant[elbowIndex + 1], y: newPosition }
      }
    }

    elbowVariants.push(variant)
  }

  return {
    elbowVariants,
    movableSegments,
  }
}
