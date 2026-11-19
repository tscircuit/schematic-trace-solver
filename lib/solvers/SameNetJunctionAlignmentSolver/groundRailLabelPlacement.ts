import type { Point } from "@tscircuit/math-utils"
import type { ConnectivityMap } from "connectivity-map"
import { traceCrossesBoundsInterior } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  getCenterFromAnchor,
  getRectBounds,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { rectsOverlap } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import {
  nearlyEqual,
  RAIL_ALIGNMENT_EPSILON,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputProblem } from "lib/types/InputProblem"

/** True when the label's net joins more than two pins through one rail. */
export const hasSharedGroundRail = (
  inputProblem: InputProblem,
  netConnMap: ConnectivityMap,
  globalConnNetId: string,
) =>
  inputProblem.netConnections.some(
    (connection) =>
      connection.pinIds.length > 2 &&
      netConnMap.getNetConnectedToId(connection.netId) === globalConnNetId,
  )

/**
 * Follow one continuous vertical column of a net downward from `startY`.
 * Separate branches may share the x coordinate without touching the column.
 */
export const getLowestConnectedColumnY = ({
  traces,
  globalConnNetId,
  x,
  startY,
}: {
  traces: SolvedTracePath[]
  globalConnNetId: string
  x: number
  startY: number
}) => {
  const columnSegments = traces
    .filter((trace) => trace.globalConnNetId === globalConnNetId)
    .flatMap((trace) =>
      trace.tracePath.slice(1).flatMap((end, pointIndex) => {
        const start = trace.tracePath[pointIndex]!
        return nearlyEqual(start.x, x) && nearlyEqual(end.x, x)
          ? [{ minY: Math.min(start.y, end.y), maxY: Math.max(start.y, end.y) }]
          : []
      }),
    )
    .sort((a, b) => b.maxY - a.maxY)
  let lowestY = startY
  for (const segment of columnSegments) {
    if (
      segment.maxY + RAIL_ALIGNMENT_EPSILON >= lowestY &&
      segment.minY < lowestY
    ) {
      lowestY = segment.minY
    }
  }
  return lowestY
}

/** Return the label's center at `anchorPoint` when its symbol would be clear. */
export const getClearGroundLabelCenter = ({
  label,
  labelIndex,
  anchorPoint,
  obstacles,
  traceMap,
  netLabelPlacements,
}: {
  label: NetLabelPlacement
  labelIndex: number
  anchorPoint: Point
  obstacles: ReturnType<typeof getObstacleRects>
  traceMap: Record<string, SolvedTracePath>
  netLabelPlacements: NetLabelPlacement[]
}): Point | null => {
  const center = getCenterFromAnchor(
    anchorPoint,
    label.orientation,
    label.width,
    label.height,
  )
  const bounds = getRectBounds(center, label.width, label.height)
  if (
    obstacles.some((obstacle) => rectsOverlap(bounds, obstacle)) ||
    traceCrossesBoundsInterior(bounds, traceMap) ||
    netLabelPlacements.some(
      (other, otherIndex) =>
        otherIndex !== labelIndex &&
        rectsOverlap(
          bounds,
          getRectBounds(other.center, other.width, other.height),
        ),
    )
  ) {
    return null
  }
  return center
}
