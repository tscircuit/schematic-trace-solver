import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const ANCHOR_TRACE_CLEARANCE = 1e-4
const SEGMENT_PARALLEL_EPS = 1e-6

export const isAnchoredAtBottomOfSharedVerticalHostSegment = ({
  label,
  traceMap,
  traces,
}: {
  label: NetLabelPlacement
  traceMap: Record<MspConnectionPairId, SolvedTracePath>
  traces: SolvedTracePath[]
}) =>
  label.mspConnectionPairIds.some((pairId) => {
    const hostTrace = traceMap[pairId]
    if (!hostTrace) return false
    const atBottomOfHostVertical = hostTrace.tracePath.slice(1).some((b, i) => {
      const a = hostTrace.tracePath[i]
      if (!a) return false
      return (
        Math.abs(a.x - b.x) <= SEGMENT_PARALLEL_EPS &&
        Math.abs(a.y - b.y) > SEGMENT_PARALLEL_EPS &&
        Math.abs(a.x - label.anchorPoint.x) <= ANCHOR_TRACE_CLEARANCE &&
        Math.abs(Math.min(a.y, b.y) - label.anchorPoint.y) <=
          ANCHOR_TRACE_CLEARANCE
      )
    })
    if (!atBottomOfHostVertical) return false

    return traces.some(
      (otherTrace) =>
        otherTrace.mspPairId !== hostTrace.mspPairId &&
        otherTrace.globalConnNetId === label.globalConnNetId &&
        otherTrace.tracePath.slice(1).some((b, i) => {
          const a = otherTrace.tracePath[i]
          if (!a) return false
          return (
            Math.abs(a.x - b.x) <= SEGMENT_PARALLEL_EPS &&
            Math.abs(a.y - b.y) > SEGMENT_PARALLEL_EPS &&
            Math.abs(a.x - label.anchorPoint.x) <= ANCHOR_TRACE_CLEARANCE
          )
        }),
    )
  })
