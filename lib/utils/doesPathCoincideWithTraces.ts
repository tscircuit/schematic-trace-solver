import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const COINCIDENT_EPS = 2e-3

/**
 * Returns true when an orthogonal path shares a positive-length segment with
 * an existing trace. Perpendicular crossings and point-only contact are
 * intentionally allowed.
 */
export const doesPathCoincideWithTraces = (
  path: Point[],
  traces: SolvedTracePath[],
): boolean => {
  const rangesOverlap1D = (a1: number, a2: number, b1: number, b2: number) =>
    Math.min(Math.max(a1, a2), Math.max(b1, b2)) -
      Math.max(Math.min(a1, a2), Math.min(b1, b2)) >
    COINCIDENT_EPS

  for (let i = 0; i < path.length - 1; i++) {
    const pathSegStart = path[i]!
    const pathSegEnd = path[i + 1]!
    const isVertical = Math.abs(pathSegStart.x - pathSegEnd.x) < COINCIDENT_EPS
    const isHorizontal =
      Math.abs(pathSegStart.y - pathSegEnd.y) < COINCIDENT_EPS
    if (!isVertical && !isHorizontal) continue

    const crossAxis = isVertical ? "x" : "y"
    const alongAxis = isVertical ? "y" : "x"

    for (const trace of traces) {
      for (let j = 0; j < trace.tracePath.length - 1; j++) {
        const traceSegStart = trace.tracePath[j]!
        const traceSegEnd = trace.tracePath[j + 1]!

        const isParallel =
          Math.abs(traceSegStart[crossAxis] - traceSegEnd[crossAxis]) <
          COINCIDENT_EPS
        if (!isParallel) continue

        const isCoincident =
          Math.abs(pathSegStart[crossAxis] - traceSegStart[crossAxis]) <
          COINCIDENT_EPS
        if (!isCoincident) continue

        if (
          rangesOverlap1D(
            pathSegStart[alongAxis],
            pathSegEnd[alongAxis],
            traceSegStart[alongAxis],
            traceSegEnd[alongAxis],
          )
        ) {
          return true
        }
      }
    }
  }

  return false
}
