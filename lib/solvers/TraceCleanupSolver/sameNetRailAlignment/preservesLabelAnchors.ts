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

export const preservesLabelAnchors = ({
  beforeLabels,
  afterLabels,
  beforeTraces,
  afterTraces,
}: {
  beforeLabels: NetLabelPlacement[]
  afterLabels: NetLabelPlacement[]
  beforeTraces: SolvedTracePath[]
  afterTraces: SolvedTracePath[]
}) =>
  beforeLabels.every((beforeLabel, labelIndex) => {
    const afterLabel = afterLabels[labelIndex]
    if (!afterLabel) return false
    const anchoredBefore = getAnchoredTraceIds(beforeLabel, beforeTraces)
    if (anchoredBefore.size === 0) return true

    const anchoredAfter = getAnchoredTraceIds(afterLabel, afterTraces)
    return [...anchoredBefore].every((traceId) => anchoredAfter.has(traceId))
  })
