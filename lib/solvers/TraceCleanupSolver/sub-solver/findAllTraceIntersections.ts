import type { Point } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import type { SolvedTracePath } from "../../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export interface TraceIntersection {
  traceId1: string
  segIndex1: number
  traceId2: string
  segIndex2: number
  point: Point
}

/**
 * Finds all intersections between all pairs of traces.
 * An intersection is where two trace segments cross each other.
 */
export const findAllTraceIntersections = (
  allTraces: SolvedTracePath[],
): TraceIntersection[] => {
  const intersections: TraceIntersection[] = []

  for (let i = 0; i < allTraces.length; i++) {
    for (let j = i + 1; j < allTraces.length; j++) {
      const t1 = allTraces[i]
      const t2 = allTraces[j]

      for (let s1 = 0; s1 < t1.tracePath.length - 1; s1++) {
        const p1 = t1.tracePath[s1]
        const p2 = t1.tracePath[s1 + 1]

        for (let s2 = 0; s2 < t2.tracePath.length - 1; s2++) {
          const o1 = t2.tracePath[s2]
          const o2 = t2.tracePath[s2 + 1]

          const intersection = getSegmentIntersection(p1, p2, o1, o2)
          if (intersection) {
            intersections.push({
              traceId1: t1.mspPairId as string,
              segIndex1: s1,
              traceId2: t2.mspPairId as string,
              segIndex2: s2,
              point: intersection,
            })
          }
        }
      }
    }
  }

  return intersections
}
