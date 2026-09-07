import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

const dedupConsecutive = (path: Point[]): Point[] =>
  path.filter(
    (p, i) => i === 0 || p.x !== path[i - 1]!.x || p.y !== path[i - 1]!.y,
  )

const collapseCollinear = (path: Point[]): Point[] => {
  if (path.length < 3) return path
  const out: Point[] = [path[0]!]
  for (let i = 1; i < path.length - 1; i++) {
    const prev = out[out.length - 1]!
    const cur = path[i]!
    const next = path[i + 1]!
    const collinear =
      (isVertical(prev, cur) && isVertical(cur, next)) ||
      (isHorizontal(prev, cur) && isHorizontal(cur, next))
    if (!collinear) out.push(cur)
  }
  out.push(path[path.length - 1]!)
  return out
}

export const simplifyPath = (path: Point[]): Point[] => {
  // Remove zero-length segments before each collinear collapse pass
  const pass1 = collapseCollinear(dedupConsecutive(path))
  const pass2 = collapseCollinear(dedupConsecutive(pass1))
  return dedupConsecutive(pass2)
}
