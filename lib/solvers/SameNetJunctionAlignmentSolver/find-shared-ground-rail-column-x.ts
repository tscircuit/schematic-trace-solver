import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { rectsOverlap } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  nearlyEqual,
  RAIL_ALIGNMENT_EPSILON,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

export const findSharedGroundRailColumnX = ({
  label,
  labelIndex,
  output,
  netTraces,
  traceMap,
}: {
  label: NetLabelPlacement
  labelIndex: number
  output: NetLabelPlacement[]
  netTraces: SolvedTracePath[]
  traceMap: Record<string, SolvedTracePath>
}): number => {
  const initialX = label.anchorPoint.x
  const hasVerticalAtAnchorX = netTraces.some((trace) =>
    trace.tracePath.slice(1).some((end, pointIndex) => {
      const start = trace.tracePath[pointIndex]
      if (!start) return false
      return (
        nearlyEqual(start.x, initialX) &&
        nearlyEqual(end.x, initialX) &&
        !nearlyEqual(start.y, end.y)
      )
    }),
  )
  const currentBounds = getRectBounds(label.center, label.width, label.height)
  const overlapsNeighborLabel = output.some(
    (other, otherIndex) =>
      otherIndex !== labelIndex &&
      rectsOverlap(
        currentBounds,
        getRectBounds(other.center, other.width, other.height),
      ),
  )
  if (hasVerticalAtAnchorX || !overlapsNeighborLabel) return initialX

  for (const pairId of label.mspConnectionPairIds) {
    const hostTrace = traceMap[pairId]
    if (!hostTrace) continue
    const path = simplifyPath(hostTrace.tracePath)
    for (let i = 0; i < path.length - 1; i++) {
      const p0 = path[i]
      const p1 = path[i + 1]
      if (!p0 || !p1) continue
      if (
        !isHorizontal(p0, p1) ||
        !nearlyEqual(p0.y, label.anchorPoint.y) ||
        label.anchorPoint.x < Math.min(p0.x, p1.x) - RAIL_ALIGNMENT_EPSILON ||
        label.anchorPoint.x > Math.max(p0.x, p1.x) + RAIL_ALIGNMENT_EPSILON
      ) {
        continue
      }
      for (const endpoint of [p0, p1]) {
        const sharedColumn = netTraces.some(
          (otherTrace) =>
            otherTrace.mspPairId !== hostTrace.mspPairId &&
            otherTrace.tracePath.slice(1).some((end, pointIndex) => {
              const start = otherTrace.tracePath[pointIndex]
              if (!start) return false
              return (
                nearlyEqual(start.x, endpoint.x) &&
                nearlyEqual(end.x, endpoint.x) &&
                !nearlyEqual(start.y, end.y)
              )
            }),
        )
        if (sharedColumn) return endpoint.x
      }
    }
  }

  return initialX
}
