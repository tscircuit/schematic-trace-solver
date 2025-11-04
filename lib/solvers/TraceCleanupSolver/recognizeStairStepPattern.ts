import type { Point } from "graphics-debug"

/**
 * Recognizes a "stair-step" pattern within a given path of points starting from a specified index.
 * A stair-step pattern is characterized by alternating horizontal and vertical segments.
 * The function checks for a sequence of at least three segments where the orientation (horizontal/vertical) alternates.
 * It returns the end index of the recognized stair-step pattern if found, otherwise -1.
 */
export const recognizeStairStepPattern = (
  pathToCheck: Point[],
  startIdx: number,
): number => {
  if (startIdx >= pathToCheck.length - 3) return -1

  let endIdx = startIdx
  let isStairStep = true

  for (let i = startIdx; i < pathToCheck.length - 2 && i < startIdx + 10; i++) {
    if (i + 2 >= pathToCheck.length) break

    const p1 = pathToCheck[i]
    const p2 = pathToCheck[i + 1]
    const p3 = pathToCheck[i + 2]

    const seg1Vertical = p1.x === p2.x
    const seg2Vertical = p2.x === p3.x

    if (seg1Vertical === seg2Vertical) {
      break
    }

    const seg1Direction = seg1Vertical
      ? Math.sign(p2.y - p1.y)
      : Math.sign(p2.x - p1.x)

    if (i > startIdx) {
      const prevP = pathToCheck[i - 1]
      const prevSegVertical = prevP.x === p1.x
      const prevDirection = prevSegVertical
        ? Math.sign(p1.y - prevP.y)
        : Math.sign(p1.x - prevP.x)

      if (
        (seg1Vertical && prevSegVertical && seg1Direction !== prevDirection) ||
        (!seg1Vertical && !prevSegVertical && seg1Direction !== prevDirection)
      ) {
        isStairStep = false
        break
      }
    }

    endIdx = i + 2
  }

  return isStairStep && endIdx - startIdx >= 3 ? endIdx : -1
}
