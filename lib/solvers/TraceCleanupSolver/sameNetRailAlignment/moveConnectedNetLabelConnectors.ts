import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getMovedAnchorPointForReroute } from "lib/solvers/Example28Solver/getMovedAnchorPointForReroute"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { pointsEqual } from "./geometry"

const tracePathChanged = (
  originalTrace: SolvedTracePath,
  reroutedTrace: SolvedTracePath,
) =>
  originalTrace.tracePath.length !== reroutedTrace.tracePath.length ||
  reroutedTrace.tracePath.some(
    (point, index) => !pointsEqual(point, originalTrace.tracePath[index]!),
  )

export const moveConnectedNetLabelConnectors = ({
  originalTraces,
  reroutedTraces,
  netLabelPlacements,
  eligibleTraceIds,
}: {
  originalTraces: SolvedTracePath[]
  reroutedTraces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  eligibleTraceIds: ReadonlySet<MspConnectionPairId>
}) => {
  const outputTraces = [...reroutedTraces]
  const outputNetLabelPlacements = [...netLabelPlacements]
  const movedConnectorTraceIds = new Set<MspConnectionPairId>()

  for (
    let labelIndex = 0;
    labelIndex < netLabelPlacements.length;
    labelIndex++
  ) {
    const originalLabel = netLabelPlacements[labelIndex]!

    for (const hostTraceId of originalLabel.mspConnectionPairIds) {
      const originalHostTrace = originalTraces.find(
        (trace) => trace.mspPairId === hostTraceId,
      )
      const reroutedHostTrace = reroutedTraces.find(
        (trace) => trace.mspPairId === hostTraceId,
      )
      if (!originalHostTrace || !reroutedHostTrace) continue
      if (!tracePathChanged(originalHostTrace, reroutedHostTrace)) continue
      if (
        tracePathContainsPoint(
          originalHostTrace.tracePath,
          originalLabel.anchorPoint,
        )
      ) {
        continue
      }

      const connectorTraceIndex = outputTraces.findIndex((trace) => {
        if (eligibleTraceIds.has(trace.mspPairId)) return false
        if (trace.globalConnNetId !== originalLabel.globalConnNetId)
          return false
        if (
          !tracePathContainsPoint(trace.tracePath, originalLabel.anchorPoint)
        ) {
          return false
        }
        return trace.tracePath.some((point) =>
          tracePathContainsPoint(originalHostTrace.tracePath, point),
        )
      })
      if (connectorTraceIndex < 0) continue

      const connectorTrace = outputTraces[connectorTraceIndex]!
      const originalJunctionPoint = connectorTrace.tracePath.find((point) =>
        tracePathContainsPoint(originalHostTrace.tracePath, point),
      )
      if (!originalJunctionPoint) continue

      const reroutedJunctionPoint = getMovedAnchorPointForReroute(
        originalJunctionPoint,
        originalHostTrace.tracePath,
        reroutedHostTrace.tracePath,
      )
      if (!reroutedJunctionPoint) continue

      const translation = {
        x: reroutedJunctionPoint.x - originalJunctionPoint.x,
        y: reroutedJunctionPoint.y - originalJunctionPoint.y,
      }
      outputTraces[connectorTraceIndex] = {
        ...connectorTrace,
        tracePath: connectorTrace.tracePath.map((point) => ({
          x: point.x + translation.x,
          y: point.y + translation.y,
        })),
      }
      outputNetLabelPlacements[labelIndex] = {
        ...originalLabel,
        anchorPoint: {
          x: originalLabel.anchorPoint.x + translation.x,
          y: originalLabel.anchorPoint.y + translation.y,
        },
        center: {
          x: originalLabel.center.x + translation.x,
          y: originalLabel.center.y + translation.y,
        },
      }
      movedConnectorTraceIds.add(connectorTrace.mspPairId)
      break
    }
  }

  return {
    traces: outputTraces,
    netLabelPlacements: outputNetLabelPlacements,
    movedConnectorTraceIds,
  }
}
