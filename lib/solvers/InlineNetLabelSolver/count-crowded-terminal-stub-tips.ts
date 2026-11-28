import type { InlineNetLabelOutput } from "./InlineNetLabelSolver"
import { INLINE_NET_LABEL_STUB_TRACE_CLEARANCE } from "./InlineNetLabelSolver"

const GEOMETRY_EPSILON = 1e-6

export const countCrowdedTerminalStubTips = (
  output: Omit<InlineNetLabelOutput, "inputProblem">,
): number => {
  if (!output.netLabelConnectorTraceIds?.size) return 0
  let crowdedCount = 0
  for (const placement of output.inlineNetLabelPlacements) {
    if (!placement.stubTracePath) continue
    const [start, currentEnd] = placement.stubTracePath
    const alongAxis = placement.axis
    const acrossAxis = alongAxis === "x" ? "y" : "x"
    const direction = Math.sign(currentEnd[alongAxis] - start[alongAxis]) || 1
    const currentLength = Math.abs(currentEnd[alongAxis] - start[alongAxis])
    const intendedLength = Math.max(currentLength, placement.width + 0.2, 0.6)
    const maxClearDistance =
      intendedLength + INLINE_NET_LABEL_STUB_TRACE_CLEARANCE + GEOMETRY_EPSILON

    const isCrowded = output.traces.some((trace) => {
      if (!output.netLabelConnectorTraceIds?.has(trace.mspPairId)) return false
      if (trace.globalConnNetId === placement.globalConnNetId) return false
      if (trace.pinIds.some((pinId) => placement.pinIds.includes(pinId))) {
        return false
      }
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        const segStart = trace.tracePath[i]
        const segEnd = trace.tracePath[i + 1]
        if (!segStart || !segEnd) continue
        const startAlong = (segStart[alongAxis] - start[alongAxis]) * direction
        const endAlong = (segEnd[alongAxis] - start[alongAxis]) * direction
        if (Math.abs(startAlong - endAlong) > GEOMETRY_EPSILON) continue
        const minAcross = Math.min(
          segStart[acrossAxis] - start[acrossAxis],
          segEnd[acrossAxis] - start[acrossAxis],
        )
        const maxAcross = Math.max(
          segStart[acrossAxis] - start[acrossAxis],
          segEnd[acrossAxis] - start[acrossAxis],
        )
        const perpendicularAlong = (startAlong + endAlong) / 2
        if (
          minAcross <= GEOMETRY_EPSILON &&
          maxAcross >= -GEOMETRY_EPSILON &&
          perpendicularAlong >= -GEOMETRY_EPSILON &&
          perpendicularAlong <= maxClearDistance
        ) {
          return true
        }
      }
      return false
    })
    if (isCrowded) crowdedCount++
  }
  return crowdedCount
}
