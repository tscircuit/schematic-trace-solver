import type { Point } from "@tscircuit/math-utils"

export interface AxisAlignedSegment {
  start: Point
  end: Point
  axis: "x" | "y"
  length: number
}

/**
 * Returns the longest axis-aligned run of a trace path - the stretch of wire an
 * inline net label can sit alongside without crossing a corner.
 *
 * Consecutive segments that continue in the same direction are merged first, so
 * a straight stretch that was split into several points still counts as one
 * run. A reversal (a trace doubling back on itself) starts a new run.
 */
export const getLongestAxisAlignedSegment = (
  path: Point[],
  epsilon = 1e-6,
): AxisAlignedSegment | null => {
  let best: AxisAlignedSegment | null = null

  let runStart: Point | null = null
  let runAxis: "x" | "y" | null = null
  let runSign = 0

  const closeRun = (runEnd: Point) => {
    if (!runStart || !runAxis) return
    const length =
      runAxis === "x"
        ? Math.abs(runEnd.x - runStart.x)
        : Math.abs(runEnd.y - runStart.y)
    if (length > epsilon && (!best || length > best.length)) {
      best = { start: runStart, end: runEnd, axis: runAxis, length }
    }
    runStart = null
    runAxis = null
    runSign = 0
  }

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    const dx = b.x - a.x
    const dy = b.y - a.y

    // Skip zero-length hops, and ignore diagonal segments (traces are
    // orthogonal; a diagonal has no well-defined "parallel" direction).
    if (Math.abs(dx) <= epsilon && Math.abs(dy) <= epsilon) continue
    const axis: "x" | "y" | null =
      Math.abs(dy) <= epsilon ? "x" : Math.abs(dx) <= epsilon ? "y" : null
    if (!axis) {
      closeRun(a)
      continue
    }
    const sign = Math.sign(axis === "x" ? dx : dy)

    if (runStart && runAxis === axis && runSign === sign) continue

    closeRun(a)
    runStart = a
    runAxis = axis
    runSign = sign
  }

  if (path.length >= 2) {
    closeRun(path[path.length - 1]!)
  }

  return best
}
