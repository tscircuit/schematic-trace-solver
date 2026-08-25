import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const getAnchoredTraceIds = (
  label: NetLabelPlacement,
  traces: SolvedTracePath[],
) =>
  new Set(
    traces
      .filter(
        (trace) =>
          trace.globalConnNetId === label.globalConnNetId &&
          tracePathContainsPoint(trace.tracePath, label.anchorPoint),
      )
      .map((trace) => trace.mspPairId),
  )

export const preservesLabelAnchors = (
  labels: NetLabelPlacement[],
  before: SolvedTracePath[],
  after: SolvedTracePath[],
) =>
  labels.every((label) => {
    const anchoredBefore = getAnchoredTraceIds(label, before)
    if (anchoredBefore.size === 0) return true

    const anchoredAfter = getAnchoredTraceIds(label, after)
    return [...anchoredBefore].every((traceId) => anchoredAfter.has(traceId))
  })
