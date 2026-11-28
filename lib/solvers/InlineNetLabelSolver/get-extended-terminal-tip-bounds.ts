import type { Bounds } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InlineNetLabelPlacement } from "./InlineNetLabelSolver"

const EPS = 1e-6
const CLEARANCE = 0.05
const TERMINAL_STUB_TIP_CLEARANCE = 0.2

export const getExtendedTerminalTipBounds = ({
  label,
  traces,
  netLabelConnectorTraceIds,
}: {
  label: InlineNetLabelPlacement
  traces: readonly SolvedTracePath[]
  netLabelConnectorTraceIds?: ReadonlySet<string>
}): Bounds | null => {
  if (!label.stubTracePath || !netLabelConnectorTraceIds?.size) return null
  const [start, currentEnd] = label.stubTracePath
  const alongAxis = label.axis
  const acrossAxis = alongAxis === "x" ? "y" : "x"
  const direction = Math.sign(currentEnd[alongAxis] - start[alongAxis]) || 1
  const currentLength = Math.abs(currentEnd[alongAxis] - start[alongAxis])
  const intendedLength = Math.max(currentLength, label.width + 0.2, 0.6)
  const triggerDistance = intendedLength + CLEARANCE + EPS

  const hasButtedConnectorLeg = traces.some((trace) => {
    if (!netLabelConnectorTraceIds.has(trace.mspPairId)) return false
    if (trace.globalConnNetId === label.globalConnNetId) return false
    if (trace.pinIds.some((pinId) => label.pinIds.includes(pinId))) return false
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const segStart = trace.tracePath[i]
      const segEnd = trace.tracePath[i + 1]
      if (!segStart || !segEnd) continue
      const startAlong = (segStart[alongAxis] - start[alongAxis]) * direction
      const endAlong = (segEnd[alongAxis] - start[alongAxis]) * direction
      if (Math.abs(startAlong - endAlong) > EPS) continue
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
        minAcross <= EPS &&
        maxAcross >= -EPS &&
        perpendicularAlong >= -EPS &&
        perpendicularAlong <= triggerDistance
      ) {
        return true
      }
    }
    return false
  })
  if (!hasButtedConnectorLeg) return null

  const tipExtent =
    start[alongAxis] +
    direction * (intendedLength + TERMINAL_STUB_TIP_CLEARANCE - CLEARANCE)
  const minAlong = Math.min(start[alongAxis], tipExtent)
  const maxAlong = Math.max(start[alongAxis], tipExtent)
  const minAcross = start[acrossAxis] - EPS
  const maxAcross = start[acrossAxis] + EPS
  return alongAxis === "x"
    ? { minX: minAlong, maxX: maxAlong, minY: minAcross, maxY: maxAcross }
    : { minX: minAcross, maxX: maxAcross, minY: minAlong, maxY: maxAlong }
}
