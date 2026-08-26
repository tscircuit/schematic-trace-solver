import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import {
  getRailOrientation,
  RAIL_ALIGNMENT_EPSILON,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { RailOrientation } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/types"
import { SCHEMATIC_TRACE_MIN_VISUAL_CENTERLINE_CLEARANCE } from "lib/utils/doesPathCoincideWithTraces"

interface InternalTrunkSegment {
  segmentIndex: number
  orientation: RailOrientation
  coordinate: number
  minAlong: number
  maxAlong: number
}

const getInternalTrunkSegments = (
  trace: SolvedTracePath,
): InternalTrunkSegment[] => {
  const segments: InternalTrunkSegment[] = []
  const path = trace.tracePath

  for (let segmentIndex = 1; segmentIndex < path.length - 2; segmentIndex++) {
    const previous = path[segmentIndex - 1]!
    const start = path[segmentIndex]!
    const end = path[segmentIndex + 1]!
    const next = path[segmentIndex + 2]!
    const orientation = getRailOrientation(start, end)
    if (!orientation) continue

    const previousOrientation = getRailOrientation(previous, start)
    const nextOrientation = getRailOrientation(end, next)
    if (!previousOrientation || !nextOrientation) continue
    if (
      previousOrientation === orientation ||
      nextOrientation === orientation
    ) {
      continue
    }

    let alongCoordinates: [number, number]
    if (orientation === "vertical") {
      alongCoordinates = [start.y, end.y]
    } else {
      alongCoordinates = [start.x, end.x]
    }
    let coordinate = start.y
    if (orientation === "vertical") coordinate = start.x
    segments.push({
      segmentIndex,
      orientation,
      coordinate,
      minAlong: Math.min(...alongCoordinates),
      maxAlong: Math.max(...alongCoordinates),
    })
  }

  return segments
}

const havePositiveOverlap = ({
  first,
  second,
}: {
  first: InternalTrunkSegment
  second: InternalTrunkSegment
}) =>
  Math.min(first.maxAlong, second.maxAlong) -
    Math.max(first.minAlong, second.minAlong) >
  RAIL_ALIGNMENT_EPSILON

/** Collapses visually doubled same-net trunks that leave the same shared pin. */
export const getAlignedSharedPinParallelTrunkPath = ({
  donorTrace,
  branchTrace,
}: {
  donorTrace: SolvedTracePath
  branchTrace: SolvedTracePath
}): Point[] | null => {
  const branchPinIds = new Set(branchTrace.pinIds)
  if (!donorTrace.pinIds.some((pinId) => branchPinIds.has(pinId))) return null

  const donorSegments = getInternalTrunkSegments(donorTrace)
  const branchSegments = getInternalTrunkSegments(branchTrace)
  let bestPath: Point[] | null = null
  let smallestDisplacement = Number.POSITIVE_INFINITY

  for (const donorSegment of donorSegments) {
    for (const branchSegment of branchSegments) {
      if (donorSegment.orientation !== branchSegment.orientation) continue
      if (
        !havePositiveOverlap({ first: donorSegment, second: branchSegment })
      ) {
        continue
      }

      const displacement = Math.abs(
        donorSegment.coordinate - branchSegment.coordinate,
      )
      if (displacement <= RAIL_ALIGNMENT_EPSILON) continue
      if (displacement > SCHEMATIC_TRACE_MIN_VISUAL_CENTERLINE_CLEARANCE) {
        continue
      }
      if (displacement >= smallestDisplacement) continue

      bestPath = simplifyPath(
        branchTrace.tracePath.map((point, pointIndex) => {
          if (
            pointIndex !== branchSegment.segmentIndex &&
            pointIndex !== branchSegment.segmentIndex + 1
          ) {
            return point
          }
          if (branchSegment.orientation === "vertical") {
            return { ...point, x: donorSegment.coordinate }
          }
          return { ...point, y: donorSegment.coordinate }
        }),
      )
      smallestDisplacement = displacement
    }
  }

  return bestPath
}
