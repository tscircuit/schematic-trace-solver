import type { Point } from "@tscircuit/math-utils"

export interface OrthogonalSegment {
  /** Index i such that the segment goes from path[i] to path[i + 1] */
  segmentIndex: number
  orientation: "horizontal" | "vertical"
  /** The fixed axis coordinate: y for horizontal segments, x for vertical */
  coord: number
  /** Span along the segment axis: x for horizontal segments, y for vertical */
  spanMin: number
  spanMax: number
  length: number
  /**
   * A segment is movable when neither of its points is a path endpoint.
   * Path endpoints sit on pins (or net label anchors) and must never move.
   */
  isMovable: boolean
}

const EPS = 1e-6

/**
 * Decomposes an orthogonal trace path into horizontal/vertical segments.
 * Zero-length and diagonal segments are skipped.
 */
export const getOrthogonalSegments = (path: Point[]): OrthogonalSegment[] => {
  const segments: OrthogonalSegment[] = []

  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    const dx = Math.abs(a.x - b.x)
    const dy = Math.abs(a.y - b.y)

    const isHorizontal = dy < EPS && dx > EPS
    const isVertical = dx < EPS && dy > EPS
    if (!isHorizontal && !isVertical) continue

    segments.push({
      segmentIndex: i,
      orientation: isHorizontal ? "horizontal" : "vertical",
      coord: isHorizontal ? a.y : a.x,
      spanMin: isHorizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y),
      spanMax: isHorizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y),
      length: isHorizontal ? dx : dy,
      isMovable: i > 0 && i + 1 < path.length - 1,
    })
  }

  return segments
}
