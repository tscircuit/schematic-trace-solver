import { countPathIntersections } from "lib/solvers/Example28Solver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"
import { getSameNetJunctions } from "lib/utils/getSameNetJunctions"
import { EPS, getDistance, tracePathContainsPoint } from "./geometry"
import type { TraceCornerCandidate } from "./types"

/** Project a terminal rail label onto its pin's exit row after routing clears it. */
export const getStraightPortConnectorCandidate = ({
  label,
  traces,
  netLabelPlacements,
  netLabelConnectorTraceIds,
  inputProblem,
}: {
  label: NetLabelPlacement
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  netLabelConnectorTraceIds: ReadonlySet<string>
  inputProblem: InputProblem
}): TraceCornerCandidate | undefined => {
  if (
    label.pinIds.length !== 1 ||
    (label.orientation !== "y+" && label.orientation !== "y-")
  )
    return

  const pins = inputProblem.chips.flatMap((chip) => chip.pins)
  const pin = pins.find((pin) => pin.pinId === label.pinIds[0])
  if (!pin) return

  for (const connector of traces) {
    if (
      !netLabelConnectorTraceIds.has(connector.mspPairId) ||
      connector.globalConnNetId !== label.globalConnNetId ||
      connector.pinIds.length !== 1 ||
      connector.pinIds[0] !== pin.pinId
    )
      continue

    const path = simplifyPath(connector.tracePath)
    // A single elbow adapts to the label's facing direction. Reconsider only
    // connectors with an extra jog introduced while routing around obstacles.
    if (path.length < 4) continue
    if (getDistance(path.at(-1)!, pin) <= EPS) path.reverse()
    if (
      getDistance(path[0]!, pin) > EPS ||
      getDistance(path.at(-1)!, label.anchorPoint) > EPS ||
      Math.abs(path[1]!.y - pin.y) > EPS
    )
      continue

    const anchorPoint = { x: label.anchorPoint.x, y: pin.y }
    // Keep the label on the same side of the pin as its existing exit segment.
    if ((anchorPoint.x - pin.x) * (path[1]!.x - pin.x) <= EPS) continue
    const reroutedTracePath = [path[0]!, anchorPoint]
    const protectedPoints = [
      ...getSameNetJunctions(connector, traces),
      ...pins,
      ...netLabelPlacements
        .filter((other) => other !== label)
        .map((other) => other.anchorPoint),
    ].filter((point) => tracePathContainsPoint(path, point))
    if (
      !protectedPoints.every((point) =>
        tracePathContainsPoint(reroutedTracePath, point),
      )
    )
      continue

    // An existing perpendicular crossing can move along the same wire, but
    // straightening must not introduce an additional crossing with any net.
    if (
      traces.some(
        (other) =>
          other.globalConnNetId !== connector.globalConnNetId &&
          countPathIntersections(reroutedTracePath, other.tracePath) >
            countPathIntersections(path, other.tracePath),
      )
    )
      continue

    return {
      anchorPoint,
      traceId: connector.mspPairId,
      distance: getDistance(anchorPoint, label.anchorPoint),
      pinAligned: true,
      reroutedTracePath,
    }
  }
}
