import { boundsIntersection, type Bounds } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  SCHEMATIC_TRACE_MIN_CENTERLINE_CLEARANCE,
  SCHEMATIC_TRACE_MIN_VISUAL_CENTERLINE_CLEARANCE,
} from "lib/utils/doesPathCoincideWithTraces"
import {
  getDistinctCoordinates,
  getRailOrientation,
  RAIL_ALIGNMENT_EPSILON,
} from "./geometry"
import type { RailOrientation, RailSegment } from "./types"

const getAlongBounds = (
  orientation: RailOrientation,
  minAlong: number,
  maxAlong: number,
): Bounds =>
  orientation === "vertical"
    ? { minX: 0, maxX: 0, minY: minAlong, maxY: maxAlong }
    : { minX: minAlong, maxX: maxAlong, minY: 0, maxY: 0 }

const hasPositiveAlongOverlap = (
  orientation: RailOrientation,
  first: Bounds,
  second: Bounds,
) => {
  const overlap = boundsIntersection(first, second)
  if (!overlap) return false
  const overlapLength =
    orientation === "vertical"
      ? overlap.maxY - overlap.minY
      : overlap.maxX - overlap.minX
  return overlapLength > RAIL_ALIGNMENT_EPSILON
}

/**
 * Derives alternatives only for original alignment coordinates whose rendered
 * stroke touches a parallel segment from another net.
 */
export const getRailAlignmentFallbackCoordinates = ({
  group,
  originalCoordinates,
  otherNetTraces,
}: {
  group: RailSegment[]
  originalCoordinates: number[]
  otherNetTraces: SolvedTracePath[]
}) => {
  const orientation = group[0]!.orientation
  const groupAlongBounds = group.map((segment) =>
    getAlongBounds(orientation, segment.minAlong, segment.maxAlong),
  )
  const fallbackClearance = SCHEMATIC_TRACE_MIN_VISUAL_CENTERLINE_CLEARANCE
  const coordinates: number[] = []

  for (const trace of otherNetTraces) {
    for (let index = 0; index < trace.tracePath.length - 1; index++) {
      const start = trace.tracePath[index]!
      const end = trace.tracePath[index + 1]!
      if (getRailOrientation(start, end) !== orientation) continue

      const minAlong =
        orientation === "vertical"
          ? Math.min(start.y, end.y)
          : Math.min(start.x, end.x)
      const maxAlong =
        orientation === "vertical"
          ? Math.max(start.y, end.y)
          : Math.max(start.x, end.x)
      const traceAlongBounds = getAlongBounds(orientation, minAlong, maxAlong)
      if (
        !groupAlongBounds.some((bounds) =>
          hasPositiveAlongOverlap(orientation, bounds, traceAlongBounds),
        )
      ) {
        continue
      }

      const coordinate = orientation === "vertical" ? start.x : start.y
      const touchesOriginalCandidate = originalCoordinates.some(
        (originalCoordinate) =>
          Math.abs(originalCoordinate - coordinate) <=
          SCHEMATIC_TRACE_MIN_CENTERLINE_CLEARANCE,
      )
      if (!touchesOriginalCandidate) continue

      coordinates.push(
        coordinate - fallbackClearance,
        coordinate + fallbackClearance,
      )
    }
  }

  return getDistinctCoordinates(coordinates)
}
