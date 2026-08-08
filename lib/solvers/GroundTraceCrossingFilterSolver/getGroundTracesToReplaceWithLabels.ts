import { distance } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const GROUND_NET_ID = "GND"
const INTERSECTION_ENDPOINT_TOLERANCE = 1e-6

export const tracePathsHaveInteriorIntersection = ({
  firstTracePath,
  secondTracePath,
}: {
  firstTracePath: SolvedTracePath["tracePath"]
  secondTracePath: SolvedTracePath["tracePath"]
}): boolean => {
  for (
    let firstSegmentIndex = 0;
    firstSegmentIndex < firstTracePath.length - 1;
    firstSegmentIndex++
  ) {
    const firstSegmentStart = firstTracePath[firstSegmentIndex]!
    const firstSegmentEnd = firstTracePath[firstSegmentIndex + 1]!

    for (
      let secondSegmentIndex = 0;
      secondSegmentIndex < secondTracePath.length - 1;
      secondSegmentIndex++
    ) {
      const secondSegmentStart = secondTracePath[secondSegmentIndex]!
      const secondSegmentEnd = secondTracePath[secondSegmentIndex + 1]!
      const intersection = getSegmentIntersection(
        firstSegmentStart,
        firstSegmentEnd,
        secondSegmentStart,
        secondSegmentEnd,
      )
      if (!intersection) continue

      const intersectionTouchesEndpoint =
        distance(intersection, firstSegmentStart) <=
          INTERSECTION_ENDPOINT_TOLERANCE ||
        distance(intersection, firstSegmentEnd) <=
          INTERSECTION_ENDPOINT_TOLERANCE ||
        distance(intersection, secondSegmentStart) <=
          INTERSECTION_ENDPOINT_TOLERANCE ||
        distance(intersection, secondSegmentEnd) <=
          INTERSECTION_ENDPOINT_TOLERANCE
      if (!intersectionTouchesEndpoint) return true
    }
  }

  return false
}

export const getGroundTracesToReplaceWithLabels = ({
  traces,
}: {
  traces: SolvedTracePath[]
}): SolvedTracePath[] => {
  return traces.filter((groundTrace) => {
    if (groundTrace.userNetId !== GROUND_NET_ID) return false

    return traces.some((otherTrace) => {
      if (otherTrace.globalConnNetId === groundTrace.globalConnNetId) {
        return false
      }
      return tracePathsHaveInteriorIntersection({
        firstTracePath: groundTrace.tracePath,
        secondTracePath: otherTrace.tracePath,
      })
    })
  })
}
