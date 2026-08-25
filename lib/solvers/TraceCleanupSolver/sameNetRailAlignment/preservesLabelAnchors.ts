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
  beforeLabels: NetLabelPlacement[],
  before: SolvedTracePath[],
  after: SolvedTracePath[],
  afterLabels = beforeLabels,
) =>
  beforeLabels.every((beforeLabel, labelIndex) => {
    const anchoredBefore = getAnchoredTraceIds(beforeLabel, before)
    if (anchoredBefore.size === 0) return true

    const afterLabel = afterLabels[labelIndex]
    if (!afterLabel) return false
    const anchoredAfter = getAnchoredTraceIds(afterLabel, after)
    return [...anchoredBefore].every((traceId) => anchoredAfter.has(traceId))
  })
