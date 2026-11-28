import type { Point } from "@tscircuit/math-utils"
import {
  getSegmentOrientation,
  getSegments,
  isPointWithinSegmentPrimaryRange,
} from "lib/solvers/Example28Solver/geometry"
import { EPS } from "lib/solvers/Example28Solver/types"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"

const TRACE_CLEARANCE_HALF_WIDTH = 0.005

/**
 * Resolves the updated junction point along a branch's terminal axis when a
 * perpendicular host rail shifts parallel to itself during cleanup.
 */
export const findShiftedRailBranchJunction = ({
  neighbor,
  endpoint,
  branchTraceId,
  originalTrace,
  updatedTrace,
  traces,
  inputProblem,
  allLabelPlacements = [],
  mergedLabelNetIdMap = {},
}: {
  neighbor: Point
  endpoint: Point
  branchTraceId: string
  originalTrace: SolvedTracePath
  updatedTrace: SolvedTracePath
  traces: SolvedTracePath[]
  inputProblem?: InputProblem
  allLabelPlacements?: NetLabelPlacement[]
  mergedLabelNetIdMap?: Record<string, Set<string>>
}): Point | null => {
  const dx = endpoint.x - neighbor.x
  const dy = endpoint.y - neighbor.y
  if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) return null
  if (Math.abs(dx) >= EPS && Math.abs(dy) >= EPS) return null

  const branchOrientation = getSegmentOrientation(neighbor, endpoint)
  const railOrientation =
    branchOrientation === "vertical" ? "horizontal" : "vertical"

  const hadPerpendicularHostRail = getSegments(originalTrace.tracePath).some(
    (segment) =>
      segment.orientation === railOrientation &&
      tracePathContainsPoint([segment.start, segment.end], endpoint),
  )
  if (!hadPerpendicularHostRail) return null

  let bestJunction: Point | null = null
  let bestShiftDistance = Number.POSITIVE_INFINITY
  for (const segment of getSegments(updatedTrace.tracePath)) {
    if (segment.orientation !== railOrientation) continue
    if (!isPointWithinSegmentPrimaryRange(endpoint, segment)) continue

    const candidate: Point =
      branchOrientation === "vertical"
        ? { x: neighbor.x, y: segment.start.y }
        : { x: segment.start.x, y: neighbor.y }
    const dot =
      (candidate.x - neighbor.x) * dx + (candidate.y - neighbor.y) * dy
    if (dot <= EPS) continue

    const shiftDistance =
      Math.abs(candidate.x - endpoint.x) + Math.abs(candidate.y - endpoint.y)
    if (shiftDistance < bestShiftDistance) {
      bestShiftDistance = shiftDistance
      bestJunction = candidate
    }
  }
  if (!bestJunction) return null

  const originalLen = Math.abs(dx) + Math.abs(dy)
  const updatedLen =
    Math.abs(bestJunction.x - neighbor.x) +
    Math.abs(bestJunction.y - neighbor.y)
  if (updatedLen <= originalLen + EPS) return bestJunction

  if (inputProblem) {
    for (const obs of getObstacleRects(inputProblem)) {
      const shrunk = {
        minX: obs.minX + EPS,
        maxX: obs.maxX - EPS,
        minY: obs.minY + EPS,
        maxY: obs.maxY - EPS,
      }
      if (segmentIntersectsRect(endpoint, bestJunction, shrunk)) return null
    }
  }

  for (const other of traces) {
    if (
      other.mspPairId === branchTraceId ||
      other.mspPairId === originalTrace.mspPairId ||
      other.globalConnNetId === originalTrace.globalConnNetId
    ) {
      continue
    }
    for (let i = 0; i < other.tracePath.length - 1; i++) {
      const p1 = other.tracePath[i]
      const p2 = other.tracePath[i + 1]
      if (!p1 || !p2) continue
      const rect = {
        minX: Math.min(p1.x, p2.x) - TRACE_CLEARANCE_HALF_WIDTH,
        maxX: Math.max(p1.x, p2.x) + TRACE_CLEARANCE_HALF_WIDTH,
        minY: Math.min(p1.y, p2.y) - TRACE_CLEARANCE_HALF_WIDTH,
        maxY: Math.max(p1.y, p2.y) + TRACE_CLEARANCE_HALF_WIDTH,
      }
      if (segmentIntersectsRect(endpoint, bestJunction, rect)) return null
    }
  }

  for (const label of allLabelPlacements) {
    const mergedSet = mergedLabelNetIdMap[label.globalConnNetId]
    const sameNet = mergedSet
      ? mergedSet.has(originalTrace.globalConnNetId)
      : label.globalConnNetId === originalTrace.globalConnNetId
    if (sameNet) continue
    const rect = {
      minX: label.center.x - label.width / 2 + EPS,
      maxX: label.center.x + label.width / 2 - EPS,
      minY: label.center.y - label.height / 2 + EPS,
      maxY: label.center.y + label.height / 2 - EPS,
    }
    if (segmentIntersectsRect(endpoint, bestJunction, rect)) return null
  }

  return bestJunction
}
