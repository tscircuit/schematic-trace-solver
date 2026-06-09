import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  getOrthogonalSegments,
  type OrthogonalSegment,
} from "./getOrthogonalSegments"

export interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface SameNetSegmentMerge {
  traceIndex: number
  segmentIndex: number
  orientation: "horizontal" | "vertical"
  fromCoord: number
  toCoord: number
  newTracePath: Point[]
}

export interface FindSameNetSegmentMergeParams {
  traces: SolvedTracePath[]
  /** Bounding boxes the moved segment must not enter (chip bodies) */
  obstacles: Bounds[]
  /**
   * Points the trace network is anchored at (pins, net label anchors).
   * A segment with an anchor in its interior must not move off of it.
   */
  anchorPoints: Point[]
  /** Maximum perpendicular distance between two segments for them to merge */
  maxMergeOffset: number
  /**
   * Move keys (see getMergeMoveKey) that must not be applied. Used by the
   * solver to forbid the reverse of an already-applied move so merges can't
   * oscillate between two coordinates.
   */
  forbiddenMoveKeys?: Set<string>
}

export const getMergeMoveKey = (
  mspPairId: string,
  orientation: "horizontal" | "vertical",
  fromCoord: number,
  toCoord: number,
): string =>
  `${mspPairId}|${orientation}|${fromCoord.toFixed(9)}->${toCoord.toFixed(9)}`

const EPS = 1e-6
/** Spans may be separated by up to this much along the axis and still merge */
const SPAN_TOUCH_TOLERANCE = 1e-3
/** Two parallel segments closer than this are considered overlapping traces */
const FOREIGN_NET_OVERLAP_EPS = 2e-3

interface IndexedSegment extends OrthogonalSegment {
  traceIndex: number
}

const getSpanOverlap = (a: IndexedSegment, b: IndexedSegment) =>
  Math.min(a.spanMax, b.spanMax) - Math.max(a.spanMin, b.spanMin)

/** Removes consecutive duplicate points, then collinear midpoints */
export const cleanTracePath = (path: Point[]): Point[] => {
  const deduped: Point[] = []
  for (const p of path) {
    const last = deduped[deduped.length - 1]
    if (last && Math.abs(last.x - p.x) < EPS && Math.abs(last.y - p.y) < EPS) {
      continue
    }
    deduped.push(p)
  }

  if (deduped.length < 3) return deduped

  const cleaned: Point[] = [deduped[0]!]
  for (let i = 1; i < deduped.length - 1; i++) {
    const prev = cleaned[cleaned.length - 1]!
    const curr = deduped[i]!
    const next = deduped[i + 1]!
    const collinearVertical =
      Math.abs(prev.x - curr.x) < EPS && Math.abs(curr.x - next.x) < EPS
    const collinearHorizontal =
      Math.abs(prev.y - curr.y) < EPS && Math.abs(curr.y - next.y) < EPS
    if (collinearVertical || collinearHorizontal) continue
    cleaned.push(curr)
  }
  cleaned.push(deduped[deduped.length - 1]!)

  return cleaned
}

const segmentEntersObstacle = (a: Point, b: Point, r: Bounds): boolean => {
  const isVertical = Math.abs(a.x - b.x) < EPS
  if (isVertical) {
    const x = a.x
    if (x < r.minX + EPS || x > r.maxX - EPS) return false
    const overlap =
      Math.min(Math.max(a.y, b.y), r.maxY) -
      Math.max(Math.min(a.y, b.y), r.minY)
    return overlap > EPS
  }
  const y = a.y
  if (y < r.minY + EPS || y > r.maxY - EPS) return false
  const overlap =
    Math.min(Math.max(a.x, b.x), r.maxX) - Math.max(Math.min(a.x, b.x), r.minX)
  return overlap > EPS
}

const segmentEntersAnyObstacle = (
  a: Point,
  b: Point,
  obstacles: Bounds[],
): boolean => obstacles.some((r) => segmentEntersObstacle(a, b, r))

/**
 * Finds the next pair of close, parallel, same-net trace segments that can be
 * merged onto the same X (vertical) or Y (horizontal) coordinate, returning
 * the resulting move. Returns null when no merge is possible.
 *
 * Merges are only proposed when they are safe:
 * - path endpoints (pins / net label anchors) never move
 * - the moved segment may not become collinear-overlapping with a trace of a
 *   different net (that spacing was added deliberately to keep nets apart)
 * - the moved segment may not enter a chip body
 * - the moved segment may not move off of an anchor point resting on it
 */
export const findSameNetSegmentMerge = (
  params: FindSameNetSegmentMergeParams,
): SameNetSegmentMerge | null => {
  const { traces, obstacles, anchorPoints, maxMergeOffset, forbiddenMoveKeys } =
    params

  const segmentsByNet = new Map<string, IndexedSegment[]>()
  const allSegments: IndexedSegment[][] = traces.map((trace, traceIndex) =>
    getOrthogonalSegments(trace.tracePath).map((seg) => ({
      ...seg,
      traceIndex,
    })),
  )
  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const netId = traces[traceIndex]!.globalConnNetId
    if (!segmentsByNet.has(netId)) segmentsByNet.set(netId, [])
    segmentsByNet.get(netId)!.push(...allSegments[traceIndex]!)
  }

  const candidates: Array<{ moved: IndexedSegment; target: IndexedSegment }> =
    []

  for (const segments of segmentsByNet.values()) {
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i]!
        const b = segments[j]!
        if (a.orientation !== b.orientation) continue
        if (a.traceIndex === b.traceIndex && a.segmentIndex === b.segmentIndex)
          continue

        const offset = Math.abs(a.coord - b.coord)
        if (offset < EPS || offset > maxMergeOffset + EPS) continue
        if (getSpanOverlap(a, b) < -SPAN_TOUCH_TOLERANCE) continue

        if (a.isMovable && b.isMovable) {
          // Snap the shorter segment onto the longer one
          const [moved, target] = a.length <= b.length ? [a, b] : [b, a]
          candidates.push({ moved, target })
        } else if (a.isMovable) {
          candidates.push({ moved: a, target: b })
        } else if (b.isMovable) {
          candidates.push({ moved: b, target: a })
        }
      }
    }
  }

  // Try the closest pairs first for stable, minimal corrections
  candidates.sort(
    (c1, c2) =>
      Math.abs(c1.moved.coord - c1.target.coord) -
      Math.abs(c2.moved.coord - c2.target.coord),
  )

  for (const { moved, target } of candidates) {
    const trace = traces[moved.traceIndex]!
    const i = moved.segmentIndex
    const toCoord = target.coord

    if (
      forbiddenMoveKeys?.has(
        getMergeMoveKey(
          trace.mspPairId,
          moved.orientation,
          moved.coord,
          toCoord,
        ),
      )
    ) {
      continue
    }

    const newPath = trace.tracePath.map((p) => ({ ...p }))
    if (moved.orientation === "horizontal") {
      newPath[i]!.y = toCoord
      newPath[i + 1]!.y = toCoord
    } else {
      newPath[i]!.x = toCoord
      newPath[i + 1]!.x = toCoord
    }

    // Guard: an anchor point (pin or trace endpoint of another trace) resting
    // on the segment would be disconnected by the move
    const hasStrandedAnchor = anchorPoints.some((anchor) => {
      const onOldSegment =
        moved.orientation === "horizontal"
          ? Math.abs(anchor.y - moved.coord) < EPS &&
            anchor.x > moved.spanMin - EPS &&
            anchor.x < moved.spanMax + EPS
          : Math.abs(anchor.x - moved.coord) < EPS &&
            anchor.y > moved.spanMin - EPS &&
            anchor.y < moved.spanMax + EPS
      if (!onOldSegment) return false
      const onNewSegment =
        moved.orientation === "horizontal"
          ? Math.abs(anchor.y - toCoord) < EPS
          : Math.abs(anchor.x - toCoord) < EPS
      return !onNewSegment
    })
    if (hasStrandedAnchor) continue

    // The move modifies the segment and stretches its two neighbors
    const modifiedSegmentIndices = [i - 1, i, i + 1].filter(
      (k) => k >= 0 && k + 1 < newPath.length,
    )

    // Guard: don't enter a chip body (unless that segment already did)
    const introducesObstacleCollision = modifiedSegmentIndices.some((k) => {
      const collidedBefore = segmentEntersAnyObstacle(
        trace.tracePath[k]!,
        trace.tracePath[k + 1]!,
        obstacles,
      )
      const collidesAfter = segmentEntersAnyObstacle(
        newPath[k]!,
        newPath[k + 1]!,
        obstacles,
      )
      return collidesAfter && !collidedBefore
    })
    if (introducesObstacleCollision) continue

    // Guard: don't become collinear-overlapping with a different net's trace
    const newSegments = getOrthogonalSegments(newPath).filter((seg) =>
      modifiedSegmentIndices.includes(seg.segmentIndex),
    )
    const overlapsForeignNet = newSegments.some((newSeg) =>
      traces.some((otherTrace, otherTraceIndex) => {
        if (otherTrace.globalConnNetId === trace.globalConnNetId) return false
        return allSegments[otherTraceIndex]!.some(
          (otherSeg) =>
            otherSeg.orientation === newSeg.orientation &&
            Math.abs(otherSeg.coord - newSeg.coord) < FOREIGN_NET_OVERLAP_EPS &&
            Math.min(otherSeg.spanMax, newSeg.spanMax) -
              Math.max(otherSeg.spanMin, newSeg.spanMin) >
              EPS,
        )
      }),
    )
    if (overlapsForeignNet) continue

    return {
      traceIndex: moved.traceIndex,
      segmentIndex: i,
      orientation: moved.orientation,
      fromCoord: moved.coord,
      toCoord,
      newTracePath: cleanTracePath(newPath),
    }
  }

  return null
}
