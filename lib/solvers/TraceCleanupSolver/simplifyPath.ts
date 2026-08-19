import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

const EPS = 1e-9

const pointsEqual = (a: Point, b: Point, eps = EPS): boolean =>
  Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps

const isCollinear = (p1: Point, p2: Point, p3: Point, eps = EPS): boolean => {
  if (isVertical(p1, p2, eps) && isVertical(p2, p3, eps)) return true
  if (isHorizontal(p1, p2, eps) && isHorizontal(p2, p3, eps)) return true
  const crossProduct =
    (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x)
  return Math.abs(crossProduct) < eps
}

export const simplifyPath = (path: Point[]): Point[] => {
  if (!path || path.length === 0) return []
  if (path.length === 1) return [path[0]!]

  // Step 1: Filter out consecutive duplicate points
  let deduped: Point[] = [path[0]!]
  for (let i = 1; i < path.length; i++) {
    const prev = deduped[deduped.length - 1]!
    const curr = path[i]!
    if (!pointsEqual(prev, curr)) {
      deduped.push(curr)
    }
  }

  if (deduped.length < 3) return deduped

  // Step 2: Iteratively simplify collinear points until fixed point is reached
  let current = deduped
  let changed = true
  while (changed && current.length >= 3) {
    changed = false
    const simplified: Point[] = [current[0]!]
    for (let i = 1; i < current.length - 1; i++) {
      const p1 = simplified[simplified.length - 1]!
      const p2 = current[i]!
      const p3 = current[i + 1]!

      if (isCollinear(p1, p2, p3)) {
        changed = true
        continue
      }
      simplified.push(p2)
    }
    simplified.push(current[current.length - 1]!)

    // Re-check for consecutive duplicates after pruning
    const nextDeduped: Point[] = [simplified[0]!]
    for (let i = 1; i < simplified.length; i++) {
      const prev = nextDeduped[nextDeduped.length - 1]!
      const curr = simplified[i]!
      if (pointsEqual(prev, curr)) {
        changed = true
      } else {
        nextDeduped.push(curr)
      }
    }
    current = nextDeduped
  }

  return current
}
