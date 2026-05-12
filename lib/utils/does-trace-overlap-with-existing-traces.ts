import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { doSegmentsIntersect } from "@tscircuit/math-utils"

export function doesTraceOverlapWithExistingTraces(
  newTracePath: Point[],
  existingTraces: SolvedTracePath[],
): boolean {
  for (let i = 0; i < newTracePath.length - 1; i++) {
    const newSegmentP1 = newTracePath[i]
    const newSegmentP2 = newTracePath[i + 1]

    for (const existingTrace of existingTraces) {
      for (let j = 0; j < existingTrace.tracePath.length - 1; j++) {
        const existingSegmentP1 = existingTrace.tracePath[j]
        const existingSegmentP2 = existingTrace.tracePath[j + 1]

        if (
          doSegmentsIntersect(
            newSegmentP1,
            newSegmentP2,
            existingSegmentP1,
            existingSegmentP2,
          )
        ) {
          return true // Found an intersection
        }
      }
    }
  }

  return false // No intersections found
}
