import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { EPS } from "./constants"

export const isOnShortPurelyHorizontalHostTrace = ({
  label,
  maxSpan,
  traceMap,
}: {
  label: NetLabelPlacement
  maxSpan: number
  traceMap: Readonly<Record<string, SolvedTracePath>>
}): boolean => {
  if (label.mspConnectionPairIds.length === 0) return false
  return label.mspConnectionPairIds.every((traceId) => {
    const hostTrace = traceMap[traceId]
    if (!hostTrace || hostTrace.tracePath.length < 2) return false
    const xs = hostTrace.tracePath.map((point) => point.x)
    const span = Math.max(...xs) - Math.min(...xs)
    return (
      span < maxSpan &&
      hostTrace.tracePath.every(
        (point) => Math.abs(point.y - label.anchorPoint.y) <= EPS,
      )
    )
  })
}
