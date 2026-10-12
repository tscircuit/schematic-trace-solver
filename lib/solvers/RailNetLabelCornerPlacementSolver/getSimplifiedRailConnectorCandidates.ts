import { traceCrossesBoundsInterior } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import {
  countPathIntersections,
  getPathLength,
} from "lib/solvers/Example28Solver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { countTurns } from "lib/solvers/TraceCleanupSolver/countTurns"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"
import { EPS, getDistance, getTraceCorners } from "./geometry"
import { getRemovableRailLabelConnectors } from "./getRemovableRailLabelConnectors"
import type { TraceCornerCandidate } from "./types"

/** Reattach a detoured label connector to a clearer corner of its existing rail. */
export const getSimplifiedRailConnectorCandidates = (params: {
  label: NetLabelPlacement
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  netLabelConnectorTraceIds: ReadonlySet<string>
  inputProblem: InputProblem
}): TraceCornerCandidate[] => {
  const { label, traces } = params
  if (label.orientation !== "y+" && label.orientation !== "y-") return []

  const direction = label.orientation === "y+" ? 1 : -1
  const candidates: TraceCornerCandidate[] = []
  const shortenedCandidates: TraceCornerCandidate[] = []
  // Reuse the removal checks: every existing branch, pin, and other label
  // attached to the connector must remain connected through the host rail.
  const attachments = getRemovableRailLabelConnectors({
    ...params,
    rails: traces,
  })
  for (const { connector, rail } of attachments) {
    const path = simplifyPath(connector.tracePath)
    if (countTurns(path) < 2) continue

    for (const source of getTraceCorners(simplifyPath(rail.tracePath))) {
      const anchor = label.anchorPoint
      // Approach the label from behind its wick, keeping its placement fixed.
      if ((anchor.y - source.y) * direction < -EPS) continue
      const reroutedTracePath = simplifyPath([
        source,
        { x: anchor.x, y: source.y },
        anchor,
      ])
      if (
        countTurns(reroutedTracePath) >= countTurns(path) ||
        getPathLength(reroutedTracePath) > getPathLength(path) + EPS
      )
        continue
      if (
        traces.some(
          (other) =>
            other.globalConnNetId !== connector.globalConnNetId &&
            countPathIntersections(reroutedTracePath, other.tracePath) >
              countPathIntersections(path, other.tracePath),
        )
      )
        continue

      candidates.push({
        anchorPoint: anchor,
        traceId: connector.mspPairId,
        distance: 0,
        pinAligned: true,
        reroutedTracePath,
      })
    }

    // If the connector crosses its own label and the existing anchor cannot
    // be reached cleanly, end the label at an earlier connector corner and
    // trim its unused tail. Moving only the label would leave a dangling wire.
    if (
      !traceCrossesBoundsInterior(
        getRectBounds(label.center, label.width, label.height),
        { [connector.mspPairId]: connector },
      )
    )
      continue
    const reversed = getDistance(path[0]!, label.anchorPoint) <= EPS
    const sourceToLabel = reversed ? [...path].reverse() : path
    for (let index = 1; index < sourceToLabel.length - 1; index++) {
      const previous = sourceToLabel[index - 1]!
      const anchorPoint = sourceToLabel[index]!
      // The retained segment must approach the symbol along its wick.
      if (
        Math.abs(previous.x - anchorPoint.x) > EPS ||
        (anchorPoint.y - previous.y) * direction <= EPS
      )
        continue
      const retainedPath = sourceToLabel.slice(0, index + 1)
      shortenedCandidates.push({
        anchorPoint,
        traceId: connector.mspPairId,
        distance: getDistance(anchorPoint, label.anchorPoint),
        pinAligned: true,
        reroutedTracePath: reversed ? retainedPath.reverse() : retainedPath,
      })
    }
  }
  const byPathLength = (a: TraceCornerCandidate, b: TraceCornerCandidate) =>
    getPathLength(a.reroutedTracePath!) - getPathLength(b.reroutedTracePath!) ||
    countTurns(a.reroutedTracePath!) - countTurns(b.reroutedTracePath!)
  return [
    ...candidates.sort(byPathLength),
    ...shortenedCandidates.sort(byPathLength),
  ]
}
