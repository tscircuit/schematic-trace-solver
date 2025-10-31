import type { Point } from "@tscircuit/math-utils"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

export const hasCollisionsWithLabels = (
  pathSegments: Point[],
  labels: any[],
): boolean => {
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const p1 = pathSegments[i]
    const p2 = pathSegments[i + 1]

    for (const label of labels) {
      if (segmentIntersectsRect(p1, p2, label)) {
        return true
      }
    }
  }
  return false
}
