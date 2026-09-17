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
    if (path.length !== 4) return trace
    const [firstPin, firstRail, secondRail, secondPin] = path
    if (
      !firstPin ||
      !firstRail ||
      !secondRail ||
      !secondPin ||
      !isHorizontal(firstPin, firstRail) ||
      !isVertical(firstRail, secondRail) ||
      !isHorizontal(secondRail, secondPin) ||
      !nearlyEqual(firstPin.x, secondPin.x)
    ) {
      return trace
    }

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
      tracePath: [
        firstPin,
        { x: label.anchorPoint.x, y: firstPin.y },
        { x: label.anchorPoint.x, y: secondPin.y },
        secondPin,
      ],
    }
  })
