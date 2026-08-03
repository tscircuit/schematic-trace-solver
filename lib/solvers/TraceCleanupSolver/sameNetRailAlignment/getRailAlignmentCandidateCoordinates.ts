import { boundsIntersection, type Bounds } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SCHEMATIC_TRACE_STROKE_WIDTH } from "lib/utils/doesPathCoincideWithTraces"
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

export const getRailAlignmentCandidateCoordinates = ({
  group,
  otherNetTraces,
  paddingBuffer,
}: {
  group: RailSegment[]
  otherNetTraces: SolvedTracePath[]
  paddingBuffer: number
}) => {
  const orientation = group[0]!.orientation
  const groupAlongBounds = group.map((segment) =>
    getAlongBounds(orientation, segment.minAlong, segment.maxAlong),
  )
  const centerlineClearance = Math.max(
    paddingBuffer,
    SCHEMATIC_TRACE_STROKE_WIDTH + RAIL_ALIGNMENT_EPSILON,
  )
  const coordinates = group.map((segment) => segment.coordinate)

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
      coordinates.push(
        coordinate - centerlineClearance,
        coordinate + centerlineClearance,
      )
    }
  }

  return getDistinctCoordinates(coordinates)
}
