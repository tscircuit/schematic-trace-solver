import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import {
  findPreferredReroutedSegment,
  findSegmentContainingPoint,
  getPointToSegmentDistance,
  projectPointToPath,
  projectPointToSegment,
} from "./geometry"

const ANCHOR_SLIDE_STEP = 0.05
const ANCHOR_TOUCH_EPS = 1e-6

export const moveAttachedLabelsToReroutedTrace = ({
  trace,
  originalTracePath,
  reroutedTracePath,
  netLabelPlacements,
}: {
  trace: SolvedTracePath
  originalTracePath: Point[]
  reroutedTracePath: Point[]
  netLabelPlacements: NetLabelPlacement[]
}) =>
  netLabelPlacements.map((label) => {
    if (!isLabelAttachedToTrace(label, trace)) return label

    const movedAnchorPoint = getMovedAnchorPointForReroute(
      label.anchorPoint,
      originalTracePath,
      reroutedTracePath,
    )
    if (!movedAnchorPoint) return label

    const movedLabel = placeLabelAtAnchor(label, movedAnchorPoint)

    // The rerouted trace may jog through the moved label's body (e.g. a
    // duck-under right next to the projected anchor). Slide the anchor
    // along its host segment until the body is clear.
    return (
      slideAnchorAwayFromOwnTrace(movedLabel, reroutedTracePath) ?? movedLabel
    )
  })

const placeLabelAtAnchor = (
  label: NetLabelPlacement,
  anchorPoint: Point,
): NetLabelPlacement => ({
  ...label,
  anchorPoint,
  center: {
    x: label.center.x + anchorPoint.x - label.anchorPoint.x,
    y: label.center.y + anchorPoint.y - label.anchorPoint.y,
  },
})

const segmentTouchesPoint = (start: Point, end: Point, point: Point) =>
  getPointToSegmentDistance(point, start, end) <= ANCHOR_TOUCH_EPS

/**
 * True if any trace segment crosses the label's body without touching the
 * label's anchor point. Segments through the anchor are the legitimate host
 * connection, everything else slices the label visually.
 */
const labelBodyCollidesWithTrace = (
  label: NetLabelPlacement,
  tracePath: Point[],
): boolean => {
  const bounds = getRectBounds(label.center, label.width, label.height)
  for (let i = 0; i < tracePath.length - 1; i++) {
    const start = tracePath[i]!
    const end = tracePath[i + 1]!
    if (!segmentIntersectsRect(start, end, bounds)) continue
    if (segmentTouchesPoint(start, end, label.anchorPoint)) continue
    return true
  }
  return false
}

const slideAnchorAwayFromOwnTrace = (
  label: NetLabelPlacement,
  tracePath: Point[],
): NetLabelPlacement | null => {
  if (!labelBodyCollidesWithTrace(label, tracePath)) return null

  const hostSegment = findSegmentContainingPoint(tracePath, label.anchorPoint)
  if (!hostSegment) return null

  const axis: "x" | "y" =
    hostSegment.orientation === "horizontal" ? "x" : "y"
  const lo = Math.min(hostSegment.start[axis], hostSegment.end[axis])
  const hi = Math.max(hostSegment.start[axis], hostSegment.end[axis])

  // Try anchor positions along the host segment, nearest offsets first
  const offsets: number[] = []
  for (let d = ANCHOR_SLIDE_STEP; d <= hi - lo; d += ANCHOR_SLIDE_STEP) {
    offsets.push(d, -d)
  }

  for (const offset of offsets) {
    const value = label.anchorPoint[axis] + offset
    if (value < lo || value > hi) continue

    const candidateAnchor =
      axis === "x"
        ? { x: value, y: label.anchorPoint.y }
        : { x: label.anchorPoint.x, y: value }
    const candidateLabel = placeLabelAtAnchor(label, candidateAnchor)
    if (!labelBodyCollidesWithTrace(candidateLabel, tracePath)) {
      return candidateLabel
    }
  }

  return null
}

const isLabelAttachedToTrace = (
  label: NetLabelPlacement,
  trace: SolvedTracePath,
) =>
  label.globalConnNetId === trace.globalConnNetId ||
  label.mspConnectionPairIds.includes(trace.mspPairId)

const getMovedAnchorPointForReroute = (
  anchorPoint: Point,
  originalTracePath: Point[],
  reroutedTracePath: Point[],
) => {
  const originalSegment = findSegmentContainingPoint(
    originalTracePath,
    anchorPoint,
  )
  if (!originalSegment) return null

  const preferredSegment = findPreferredReroutedSegment(
    reroutedTracePath,
    originalSegment.index,
    originalTracePath.length - 1,
    originalSegment.orientation,
    anchorPoint,
  )

  if (!preferredSegment) {
    return projectPointToPath(anchorPoint, reroutedTracePath)
  }

  return projectPointToSegment(
    anchorPoint,
    preferredSegment.start,
    preferredSegment.end,
  )
}
