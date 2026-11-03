import { LABEL_SEARCH_STEP } from "lib/solvers/AvailableNetOrientationSolver/constants"
import { traceCrossesBoundsInterior } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"
import { getSameNetJunctions } from "lib/utils/getSameNetJunctions"
import { EPS, getDistance, tracePathContainsPoint } from "./geometry"
import type { TraceCornerCandidate } from "./types"

/** Pull a crossed rail label back along its connector's terminal segment. */
export const getShortenedRailConnectorCandidates = ({
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
}): TraceCornerCandidate[] => {
  if (label.orientation !== "y+" && label.orientation !== "y-") return []
  if (
    !traceCrossesBoundsInterior(
      getRectBounds(label.center, label.width, label.height),
      Object.fromEntries(traces.map((trace) => [trace.mspPairId, trace])),
    )
  )
    return []

  const direction = label.orientation === "y+" ? 1 : -1
  const candidates: TraceCornerCandidate[] = []
  for (const connector of traces) {
    if (!netLabelConnectorTraceIds.has(connector.mspPairId)) continue
    if (connector.globalConnNetId !== label.globalConnNetId) continue
    const path = [...simplifyPath(connector.tracePath)]
    if (path.length < 2) continue
    const reversed = getDistance(path[0]!, label.anchorPoint) <= EPS
    if (reversed) path.reverse()
    if (getDistance(path.at(-1)!, label.anchorPoint) > EPS) continue

    const previous = path.at(-2)!
    const anchor = label.anchorPoint
    // Retain the approach along the symbol's wick; never move around a bend.
    if (Math.abs(previous.x - anchor.x) > EPS) continue
    const terminalLength = (anchor.y - previous.y) * direction
    if (terminalLength <= EPS) continue

    const otherLabels = netLabelPlacements.filter((other) => other !== label)
    const protectedPoints = [
      ...getSameNetJunctions(connector, traces),
      ...inputProblem.chips.flatMap((chip) => chip.pins),
      ...otherLabels.map((other) => other.anchorPoint),
    ].filter((point) => tracePathContainsPoint(path, point))

    for (
      let distance = LABEL_SEARCH_STEP;
      distance < terminalLength - EPS;
      distance += LABEL_SEARCH_STEP
    ) {
      const anchorPoint = { x: anchor.x, y: anchor.y - direction * distance }
      const retainedPath = [...path.slice(0, -1), anchorPoint]
      // Shortening must not detach a pin, another label, or a same-net branch.
      if (
        !protectedPoints.every((point) =>
          tracePathContainsPoint(retainedPath, point),
        )
      )
        break

      candidates.push({
        anchorPoint,
        traceId: connector.mspPairId,
        distance,
        pinAligned: true,
        reroutedTracePath: reversed ? retainedPath.reverse() : retainedPath,
      })
    }
  }
  return candidates.sort((a, b) => a.distance - b.distance)
}
