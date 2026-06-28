import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

/**
 * Removes consecutive duplicate points (zero-length segments) from a path.
 *
 * Post-processing steps such as `UntangleTraceSubsolver._applyBestRoute` splice a
 * rerouted segment into an existing trace by concatenating
 * `[...slice(0, p2Index), ...bestRoute, ...slice(p2Index + 1)]`. The endpoints of
 * `bestRoute` coincide with the surrounding trace points, so the concatenation
 * produces consecutive points with identical coordinates. These zero-length
 * segments are rendered as spurious "extra trace lines".
 */
const removeDuplicateConsecutivePoints = (path: Point[]): Point[] => {
  if (path.length < 2) return path
  const out: Point[] = [path[0]]
  for (let i = 1; i < path.length; i++) {
    const prev = out[out.length - 1]
    const cur = path[i]
    if (isVertical(prev, cur) && isHorizontal(prev, cur)) {
      // prev and cur are the same point (zero-length segment) -> skip
      continue
    }
    out.push(cur)
  }
  return out
}

/**
 * Removes redundant collinear points from an axis-aligned path so that each
 * retained vertex represents an actual turn.
 *
 * The previous implementation ran a single forward pass twice and always pushed
 * the final point unconditionally. That left two defects:
 *   1. Consecutive duplicate points (zero-length segments) were not removed, and
 *      a duplicate sitting next to a corner survived both passes.
 *   2. The final point was never re-checked, so when its neighbour was dropped it
 *      could end up collinear with (or identical to) the previous kept point,
 *      producing a redundant trailing segment.
 * Both defects render as extra trace lines in the schematic output.
 *
 * This implementation first strips duplicate points, then repeatedly removes any
 * interior point that is collinear with its neighbours until the path is stable,
 * which is robust regardless of point ordering.
 */
export const simplifyPath = (path: Point[]): Point[] => {
  let pts = removeDuplicateConsecutivePoints(path)
  if (pts.length < 3) return pts

  let changed = true
  while (changed) {
    changed = false
    const newPath: Point[] = [pts[0]]
    for (let i = 1; i < pts.length - 1; i++) {
      const p1 = newPath[newPath.length - 1]
      const p2 = pts[i]
      const p3 = pts[i + 1]
      if (
        (isVertical(p1, p2) && isVertical(p2, p3)) ||
        (isHorizontal(p1, p2) && isHorizontal(p2, p3))
      ) {
        changed = true
        continue
      }
      newPath.push(p2)
    }
    newPath.push(pts[pts.length - 1])
    pts = newPath
  }

  // A fully degenerate path (e.g. a trace that returns to its start) can reduce
  // to two identical endpoints. Collapse it to a single point so the result
  // never contains a zero-length segment.
  if (
    pts.length === 2 &&
    isVertical(pts[0], pts[1]) &&
    isHorizontal(pts[0], pts[1])
  ) {
    return [pts[0]]
  }

  return pts
}
