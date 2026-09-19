import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
  nearlyEqual,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"

const MAX_LOCAL_RAIL_SHIFT = 0.5
const MIN_ESCAPE_LENGTH = 1

export const shortenSameSideRailToLabelAnchor = ({
  traces,
  netLabelPlacements,
}: {
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}) =>
  traces.map((trace) => {
    const path = trace.tracePath
    const firstPin = path[0]
    const secondPin = path.at(-1)
    if (!firstPin || !secondPin || !nearlyEqual(firstPin.x, secondPin.x)) {
      return trace
    }

    const railIndex = path.findIndex(
      (point, index) =>
        index > 0 &&
        index < path.length - 2 &&
        isHorizontal(path[index - 1]!, point) &&
        isVertical(point, path[index + 1]!) &&
        isHorizontal(path[index + 1]!, path[index + 2]!),
    )
    if (railIndex < 0) return trace
    const firstRail = path[railIndex]!
    const secondRail = path[railIndex + 1]!
    const escapeLength = Math.abs(firstRail.x - firstPin.x)
    const label = netLabelPlacements.find(
      ({ anchorPoint, orientation, mspConnectionPairIds }) =>
        mspConnectionPairIds.includes(trace.mspPairId) &&
        ((orientation === "y-" &&
          anchorPoint.y < Math.min(firstPin.y, secondPin.y)) ||
          (orientation === "y+" &&
            anchorPoint.y > Math.max(firstPin.y, secondPin.y))) &&
        anchorPoint.x >= Math.min(firstPin.x, firstRail.x) &&
        anchorPoint.x <= Math.max(firstPin.x, firstRail.x) &&
        Math.abs(anchorPoint.x - firstPin.x) < escapeLength &&
        Math.abs(anchorPoint.x - firstRail.x) <= MAX_LOCAL_RAIL_SHIFT &&
        escapeLength >= MIN_ESCAPE_LENGTH,
    )
    if (!label) return trace

    return {
      ...trace,
      tracePath: path.map((point, index) =>
        index === railIndex || index === railIndex + 1
          ? { ...point, x: label.anchorPoint.x }
          : point,
      ),
    }
  })
