import type { Point } from "@tscircuit/math-utils"
import { doSegmentsIntersect } from "@tscircuit/math-utils/line-intersections"

export const doTracePathsIntersect = ({
  firstTracePath,
  secondTracePath,
}: {
  firstTracePath: Point[]
  secondTracePath: Point[]
}) => {
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
      if (
        doSegmentsIntersect(
          firstSegmentStart,
          firstSegmentEnd,
          secondSegmentStart,
          secondSegmentEnd,
        )
      ) {
        return true
      }
    }
  }
  return false
}
