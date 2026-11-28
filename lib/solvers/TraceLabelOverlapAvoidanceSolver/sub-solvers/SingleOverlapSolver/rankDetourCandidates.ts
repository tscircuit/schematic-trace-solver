import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"
import { detectTraceLabelOverlap } from "../../detectTraceLabelOverlap"

const PATH_LENGTH_EPSILON = 1e-9

export const rankDetourCandidates = ({
  candidates,
  initialTrace,
  tracesToAvoidOverlapping,
  netLabelPlacements,
}: {
  candidates: Point[][]
  initialTrace: SolvedTracePath
  tracesToAvoidOverlapping: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}): Point[][] => {
  const scored = candidates.map((path) => {
    let crossings = 0
    for (const otherTrace of tracesToAvoidOverlapping) {
      crossings += findPerpendicularPathCrossings(path, otherTrace.tracePath, {
        includeTerminalSegments: true,
      }).length
    }
    const labelOverlaps = detectTraceLabelOverlap({
      traces: [{ ...initialTrace, tracePath: path }],
      netLabels: netLabelPlacements,
    }).length
    let pathLength = 0
    for (let pointIndex = 0; pointIndex < path.length - 1; pointIndex++) {
      const point = path[pointIndex]!
      const nextPoint = path[pointIndex + 1]!
      pathLength +=
        Math.abs(nextPoint.x - point.x) + Math.abs(nextPoint.y - point.y)
    }
    return { path, crossings, labelOverlaps, pathLength }
  })

  scored.sort((a, b) => {
    const crossingDiff = a.crossings - b.crossings
    if (crossingDiff !== 0) return crossingDiff
    const overlapDiff = a.labelOverlaps - b.labelOverlaps
    if (overlapDiff !== 0) return overlapDiff
    const lengthDiff = a.pathLength - b.pathLength
    if (Math.abs(lengthDiff) >= PATH_LENGTH_EPSILON) return lengthDiff
    return a.path.length - b.path.length
  })

  return scored.map((entry) => entry.path)
}
