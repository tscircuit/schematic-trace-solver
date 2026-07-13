import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

export const simplifyPath = (path: Point[]): Point[] => {
  const dedupedPath: Point[] = []
  for (const pt of path) {
    if (dedupedPath.length === 0) {
      dedupedPath.push(pt)
    } else {
      const last = dedupedPath[dedupedPath.length - 1]
      if (last.x !== pt.x || last.y !== pt.y) {
        dedupedPath.push(pt)
      }
    }
  }

  if (dedupedPath.length < 3) return dedupedPath
  const newPath: Point[] = [dedupedPath[0]]
  for (let i = 1; i < dedupedPath.length - 1; i++) {
    const p1 = newPath[newPath.length - 1]
    const p2 = dedupedPath[i]
    const p3 = dedupedPath[i + 1]
    if (
      (isVertical(p1, p2) && isVertical(p2, p3)) ||
      (isHorizontal(p1, p2) && isHorizontal(p2, p3))
    ) {
      continue
    }
    newPath.push(p2)
  }
  newPath.push(dedupedPath[dedupedPath.length - 1])

  return newPath
}
