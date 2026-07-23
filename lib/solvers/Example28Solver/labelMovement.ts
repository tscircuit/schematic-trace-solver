import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getMovedAnchorPointForReroute } from "./getMovedAnchorPointForReroute"
import { isLabelAttachedToTrace } from "./isLabelAttachedToTrace"

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

    const delta = {
      x: movedAnchorPoint.x - label.anchorPoint.x,
      y: movedAnchorPoint.y - label.anchorPoint.y,
    }

    return {
      ...label,
      anchorPoint: movedAnchorPoint,
      center: {
        x: label.center.x + delta.x,
        y: label.center.y + delta.y,
      },
    }
  })
