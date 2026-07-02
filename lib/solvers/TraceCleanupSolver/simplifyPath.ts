import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

export const simplifyPath = (path: Point[]): Point[] => {
  if (path.length < 2) return path

  // Step 1: Remove duplicate points
  const noDuplicates: Point[] = [path[0]]
  for (let i = 1; i < path.length; i++) {
    const prev = noDuplicates[noDuplicates.length - 1]
    const current = path[i]
    if (
      Math.abs(current.x - prev.x) > 1e-9 ||
      Math.abs(current.y - prev.y) > 1e-9
    ) {
      noDuplicates.push(current)
    }
  }

  if (noDuplicates.length < 3) return noDuplicates

  // Step 2: Remove points that lie on the same straight line
  const result: Point[] = [noDuplicates[0]]
  for (let i = 1; i < noDuplicates.length - 1; i++) {
    const p1 = result[result.length - 1]
    const p2 = noDuplicates[i]
    const p3 = noDuplicates[i + 1]

    const vertical = isVertical(p1, p2) && isVertical(p2, p3)
    const horizontal = isHorizontal(p1, p2) && isHorizontal(p2, p3)

    if (!vertical && !horizontal) {
      result.push(p2)
    }
  }
  result.push(noDuplicates[noDuplicates.length - 1])

  return result
}
