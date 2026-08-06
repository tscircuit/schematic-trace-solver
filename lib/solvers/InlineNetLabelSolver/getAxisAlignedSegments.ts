import type { Point } from "@tscircuit/math-utils"

export interface AxisAlignedSegment {
  start: Point
  end: Point
  axis: "x" | "y"
  length: number
}

/**
 * Splits a trace path into its axis-aligned runs - the straight stretches of
 * wire an inline net label can sit alongside without crossing a corner -
 * ordered longest first.
 *
 * Segments that continue in the same direction are merged, so a straight
 * stretch split into several points counts as one run. A reversal (a trace
 * doubling back on itself) starts a new run, and diagonal segments are dropped
 * since they have no well-defined "parallel" direction.
 */
export const getAxisAlignedSegments = (
  path: Point[],
  epsilon = 1e-6,
): AxisAlignedSegment[] => {
  const segments: AxisAlignedSegment[] = []

  let runStart: Point | null = null
  let runAxis: "x" | "y" | null = null
  let runSign = 0

  const closeRun = (runEnd: Point) => {
    if (runStart && runAxis) {
      const length =
        runAxis === "x"
          ? Math.abs(runEnd.x - runStart.x)
          : Math.abs(runEnd.y - runStart.y)
      if (length > epsilon) {
        segments.push({ start: runStart, end: runEnd, axis: runAxis, length })
      }
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

  return segments.sort((a, b) => b.length - a.length)
}
