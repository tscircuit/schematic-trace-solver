import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { isVerticalLabelAtSameNetRailTap } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/anchors"
import {
  getDistance,
  getTraceCorners,
  tracePathContainsPoint,
} from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export interface DownwardGroundRailCornerCandidate {
  anchorPoint: Point
  trace: SolvedTracePath
}

export const findDownwardGroundRailCornerCandidates = ({
  label,
  traces,
}: {
  label: NetLabelPlacement
  traces: SolvedTracePath[]
}): DownwardGroundRailCornerCandidate[] => {
  const sameNetTraces = traces.filter(
    (trace) => trace.globalConnNetId === label.globalConnNetId,
  )
  const labelTraceIds = new Set(label.mspConnectionPairIds)
  const seedTraces = sameNetTraces.filter(
    (trace) =>
      labelTraceIds.has(trace.mspPairId) ||
      tracePathContainsPoint(trace.tracePath, label.anchorPoint),
  )
  const connectedTraceIds = new Set(seedTraces.map((trace) => trace.mspPairId))
  const connectedPinIds = new Set(seedTraces.flatMap((trace) => trace.pinIds))

  let addedTrace = true
  while (addedTrace) {
    addedTrace = false
    for (const trace of sameNetTraces) {
      if (connectedTraceIds.has(trace.mspPairId)) continue
      if (!trace.pinIds.some((pinId) => connectedPinIds.has(pinId))) continue

      connectedTraceIds.add(trace.mspPairId)
      for (const pinId of trace.pinIds) connectedPinIds.add(pinId)
      addedTrace = true
    }
  }

  const connectedTraces = sameNetTraces.filter((trace) =>
    connectedTraceIds.has(trace.mspPairId),
  )
  return connectedTraces
    .flatMap((trace) =>
      getTraceCorners(trace.tracePath).map((anchorPoint) => ({
        anchorPoint,
        trace,
      })),
    )
    .filter(
      (candidate) =>
        !isVerticalLabelAtSameNetRailTap({
          anchor: candidate.anchorPoint,
          traces: connectedTraces,
        }),
    )
    .sort(
      (first, second) =>
        getDistance(second.anchorPoint, label.anchorPoint) -
        getDistance(first.anchorPoint, label.anchorPoint),
    )
}
