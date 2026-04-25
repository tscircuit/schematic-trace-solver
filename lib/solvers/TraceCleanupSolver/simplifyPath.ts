import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

export const simplifyPath = (path: Point[]): Point[] => {
  if (path.length < 2) return path

  // Step 1: Remove zero-length segments and consecutive duplicate points
  const noDuplicates: Point[] = [path[0]]
  for (let i = 1; i < path.length; i++) {
    const prev = noDuplicates[noDuplicates.length - 1]
    const curr = path[i]
    if (Math.abs(prev.x - curr.x) > 1e-9 || Math.abs(prev.y - curr.y) > 1e-9) {
      noDuplicates.push(curr)
    }
  }

  if (noDuplicates.length < 3) return noDuplicates

  // Step 2: Merge collinear segments (Aggressive)
  const merged: Point[] = [noDuplicates[0]]
  for (let i = 1; i < noDuplicates.length - 1; i++) {
    const p1 = merged[merged.length - 1]
    const p2 = noDuplicates[i]
    const p3 = noDuplicates[i + 1]

    const vertical = Math.abs(p1.x - p2.x) < 1e-9 && Math.abs(p2.x - p3.x) < 1e-9
    const horizontal = Math.abs(p1.y - p2.y) < 1e-9 && Math.abs(p2.y - p3.y) < 1e-9

    if (!vertical && !horizontal) {
      merged.push(p2)
    }
  }
  merged.push(noDuplicates[noDuplicates.length - 1])

  return merged
}
