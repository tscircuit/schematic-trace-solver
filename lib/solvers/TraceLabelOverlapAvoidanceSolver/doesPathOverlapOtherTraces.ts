import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const EPS = 2e-3

/**
 * Returns true if any segment of the candidate path runs collinear with (and
 * overlapping) a segment of a trace from a different net. Perpendicular
 * crossings are allowed — only coincident parallel overlap counts.
 */
export const doesPathOverlapOtherTraces = ({
  path,
  globalConnNetId,
  otherTraces,
}: {
  path: Point[]
  globalConnNetId: string
  otherTraces: SolvedTracePath[]
}): boolean => {
  const overlaps1D = (a1: number, a2: number, b1: number, b2: number) =>
    Math.min(Math.max(a1, a2), Math.max(b1, b2)) -
      Math.max(Math.min(a1, a2), Math.min(b1, b2)) >
    EPS

  for (let i = 0; i < path.length - 1; i++) {
    const a1 = path[i]!
    const a2 = path[i + 1]!
    const aVert = Math.abs(a1.x - a2.x) < EPS
    const aHorz = Math.abs(a1.y - a2.y) < EPS
    if (!aVert && !aHorz) continue

    for (const other of otherTraces) {
      if (other.globalConnNetId === globalConnNetId) continue
      const pts = other.tracePath
      for (let j = 0; j < pts.length - 1; j++) {
        const b1 = pts[j]!
        const b2 = pts[j + 1]!
        if (aVert && Math.abs(b1.x - b2.x) < EPS) {
          if (
            Math.abs(a1.x - b1.x) < EPS &&
            overlaps1D(a1.y, a2.y, b1.y, b2.y)
          ) {
            return true
          }
        } else if (aHorz && Math.abs(b1.y - b2.y) < EPS) {
          if (
            Math.abs(a1.y - b1.y) < EPS &&
            overlaps1D(a1.x, a2.x, b1.x, b2.x)
          ) {
            return true
          }
        }
      }
    }
  }
  return false
}
