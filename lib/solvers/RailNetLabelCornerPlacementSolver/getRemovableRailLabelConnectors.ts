import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { getSameNetJunctions } from "lib/utils/getSameNetJunctions"
import {
  EPS,
  getDistance,
  isTraceLine,
  tracePathContainsPoint,
} from "./geometry"

/** Find dedicated label connectors whose shared attachments remain on a rail. */
export const getRemovableRailLabelConnectors = ({
  label,
  traces,
  rails,
  netLabelPlacements,
  netLabelConnectorTraceIds,
  inputProblem,
}: {
  label: NetLabelPlacement
  traces: SolvedTracePath[]
  rails: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  netLabelConnectorTraceIds: ReadonlySet<string>
  inputProblem: InputProblem
}) => {
  const attachments: Array<{
    connector: SolvedTracePath
    rail: SolvedTracePath
  }> = []
  for (const connector of traces) {
    if (!netLabelConnectorTraceIds.has(connector.mspPairId)) continue
    if (connector.globalConnNetId !== label.globalConnNetId) continue
    const endpoints = [connector.tracePath[0], connector.tracePath.at(-1)]
    if (!endpoints[0] || !endpoints[1]) continue
    const labelEnd = endpoints.findIndex(
      (point) => getDistance(point!, label.anchorPoint) <= EPS,
    )
    if (labelEnd === -1) continue
    const source = endpoints[1 - labelEnd]!
    const otherLabels = netLabelPlacements.filter((other) => other !== label)
    if (
      otherLabels.some((other) =>
        other.mspConnectionPairIds.includes(connector.mspPairId),
      )
    )
      continue

    const protectedPoints = [
      ...getSameNetJunctions(connector, traces),
      ...inputProblem.chips.flatMap((chip) => chip.pins),
      ...otherLabels.map((other) => other.anchorPoint),
    ].filter((point) => tracePathContainsPoint(connector.tracePath, point))

    for (const rail of rails) {
      if (netLabelConnectorTraceIds.has(rail.mspPairId) || !isTraceLine(rail))
        continue
      if (rail.globalConnNetId !== label.globalConnNetId) continue
      if (
        label.mspConnectionPairIds.length > 0 &&
        !label.mspConnectionPairIds.includes(rail.mspPairId)
      )
        continue
      if (!tracePathContainsPoint(rail.tracePath, source)) continue
      // Removing the connector must not strand another label, pin, or branch.
      if (
        !protectedPoints.every((point) =>
          tracePathContainsPoint(rail.tracePath, point),
        )
      )
        continue
      attachments.push({ connector, rail })
    }
  }
  return attachments
}
