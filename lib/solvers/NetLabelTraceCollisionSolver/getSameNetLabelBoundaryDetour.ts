import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentOverlapsRectBoundary } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

const BOUNDARY_EPS = 1e-9
const ANCHOR_CORNER_NUDGE = BOUNDARY_EPS / 2

const pointsEqual = (first: Point, second: Point) =>
  Math.abs(first.x - second.x) <= BOUNDARY_EPS &&
  Math.abs(first.y - second.y) <= BOUNDARY_EPS

export const getSameNetLabelBoundaryDetour = ({
  trace,
  label,
  clearance,
}: {
  trace: SolvedTracePath
  label: NetLabelPlacement
  clearance: number
}): Point[] | null => {
  if (trace.globalConnNetId !== label.globalConnNetId) return null
  if (!label.mspConnectionPairIds.includes(trace.mspPairId)) return null
  if (label.orientation !== "y-") return null

  const bounds = getRectBounds(label.center, label.width, label.height)
  const path = trace.tracePath
  for (let segmentIndex = 0; segmentIndex < path.length - 1; segmentIndex++) {
    const start = path[segmentIndex]!
    const end = path[segmentIndex + 1]!
    const anchorIsSegmentEnd =
      pointsEqual(label.anchorPoint, start) ||
      pointsEqual(label.anchorPoint, end)
    if (!anchorIsSegmentEnd) continue
    if (!segmentOverlapsRectBoundary(start, end, bounds)) continue

    const shiftedY = label.anchorPoint.y + clearance
    const anchorIsStart = pointsEqual(label.anchorPoint, start)
    let nudgeDirection = Math.sign(start.x - end.x)
    if (anchorIsStart) nudgeDirection = Math.sign(end.x - start.x)
    const nudgedAnchor = {
      x: label.anchorPoint.x + nudgeDirection * ANCHOR_CORNER_NUDGE,
      y: label.anchorPoint.y,
    }
    const shiftedNudgedAnchor = { ...nudgedAnchor, y: shiftedY }
    if (anchorIsStart) {
      return [
        ...path.slice(0, segmentIndex + 1),
        nudgedAnchor,
        shiftedNudgedAnchor,
        { x: end.x, y: shiftedY },
        ...path.slice(segmentIndex + 1),
      ]
    }
    return [
      ...path.slice(0, segmentIndex + 1),
      { x: start.x, y: shiftedY },
      shiftedNudgedAnchor,
      nudgedAnchor,
      ...path.slice(segmentIndex + 1),
    ]
  }

  return null
}
