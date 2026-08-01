import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { nearlyEqual } from "./geometry"

// Remove redundant collinear intermediate points from trace paths.
// This is conservative — it only removes a middle point if the three
// consecutive points are collinear (horizontal or vertical) within
// the numeric tolerance used across sameNetRailAlignment.

export const simplifyTraces = (traces: SolvedTracePath[]) =>
  traces.map((trace) => ({ ...trace, tracePath: simplifyTracePath(trace.tracePath) }))

export const simplifyTracePath = (path: { x: number; y: number }[]) => {
  if (path.length <= 2) return path.slice()

  const out: { x: number; y: number }[] = [path[0]!]

  for (let i = 1; i < path.length - 1; i++) {
    const prev = out[out.length - 1]!
    const curr = path[i]!
    const next = path[i + 1]!

    const horizontal = nearlyEqual(prev.y, curr.y) && nearlyEqual(curr.y, next.y)
    const vertical = nearlyEqual(prev.x, curr.x) && nearlyEqual(curr.x, next.x)

    if (horizontal || vertical) {
      // drop curr (it's collinear)
      continue
    }

    out.push(curr)
  }

  out.push(path[path.length - 1]!)
  return out
}
