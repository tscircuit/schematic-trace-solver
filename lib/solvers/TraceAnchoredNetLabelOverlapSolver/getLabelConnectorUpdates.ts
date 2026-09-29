import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRemovableRailLabelConnectors } from "lib/solvers/RailNetLabelCornerPlacementSolver/getRemovableRailLabelConnectors"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { getSameNetJunctions } from "lib/utils/getSameNetJunctions"
import { EPS, getManhattanDistance } from "./geometry"
import type { LabelConnectorUpdate } from "./types"

/** Move a dedicated connector's terminal with its label, preserving attachments. */
export const getLabelConnectorUpdates = ({
  label,
  anchorPoint,
  traces,
  netLabelPlacements,
  netLabelConnectorTraceIds,
  inputProblem,
}: {
  label: NetLabelPlacement
  anchorPoint: Point
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  netLabelConnectorTraceIds: ReadonlySet<string>
  inputProblem: InputProblem
}): LabelConnectorUpdate[] | null => {
  if (getManhattanDistance(label.anchorPoint, anchorPoint) <= EPS) return []
  const updates: LabelConnectorUpdate[] = []
  for (const connector of traces) {
    if (!netLabelConnectorTraceIds.has(connector.mspPairId)) continue
    if (connector.globalConnNetId !== label.globalConnNetId) continue
    const path = connector.tracePath
    const labelAtStart =
      path[0] && getManhattanDistance(path[0], label.anchorPoint) <= EPS
    const labelAtEnd =
      path.at(-1) &&
      getManhattanDistance(path.at(-1)!, label.anchorPoint) <= EPS
    if (!labelAtStart && !labelAtEnd) continue

    const sourceFirstPath = labelAtStart ? [...path].reverse() : path
    const segmentIndex = sourceFirstPath
      .slice(1)
      .findIndex((end, index) =>
        tracePathContainsPoint([sourceFirstPath[index]!, end], anchorPoint),
      )
    if (segmentIndex !== -1) {
      const trimmedPath = sourceFirstPath.slice(0, segmentIndex + 1)
      if (getManhattanDistance(trimmedPath.at(-1)!, anchorPoint) > EPS)
        trimmedPath.push(anchorPoint)
      if (trimmedPath.length >= 2) {
        const protectedPoints = [
          ...getSameNetJunctions(connector, traces),
          ...inputProblem.chips.flatMap((chip) => chip.pins),
          ...netLabelPlacements
            .filter((other) => other !== label)
            .map((other) => other.anchorPoint),
        ].filter((point) => tracePathContainsPoint(path, point))
        if (
          !protectedPoints.every((point) =>
            tracePathContainsPoint(trimmedPath, point),
          )
        )
          return null
        updates.push({
          traceId: connector.mspPairId,
          tracePath: labelAtStart ? trimmedPath.reverse() : trimmedPath,
        })
        continue
      }
    }

    // A direct attachment to the host makes the connector redundant. Reuse the
    // rail solver's attachment checks before removing any branch geometry.
    const attachment = getRemovableRailLabelConnectors({
      label,
      traces,
      rails: traces.filter((trace) =>
        tracePathContainsPoint(trace.tracePath, anchorPoint),
      ),
      netLabelPlacements,
      netLabelConnectorTraceIds,
      inputProblem,
    }).find(
      (attachment) => attachment.connector.mspPairId === connector.mspPairId,
    )
    if (!attachment) return null
    updates.push({
      traceId: connector.mspPairId,
      tracePath: [],
      replacementHostTraceId: attachment.rail.mspPairId,
    })
  }
  return updates
}
