import type { Bounds } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { boundsOverlap } from "lib/utils/textBoxBounds"
import { getAnchoredNetLabelRenderedBounds } from "./getAnchoredNetLabelRenderedBounds"

export const hasMovedAnchoredLabelCollision = ({
  labels,
  originalLabels,
  obstacles,
  inlineBounds,
  allTraces,
}: {
  labels: readonly NetLabelPlacement[]
  originalLabels: readonly NetLabelPlacement[]
  obstacles: readonly Bounds[]
  inlineBounds: readonly Bounds[]
  allTraces: readonly SolvedTracePath[]
}): boolean => {
  for (const [index, label] of labels.entries()) {
    if (label === originalLabels[index]) continue
    const bounds = getAnchoredNetLabelRenderedBounds(label)
    if (
      obstacles.some((obstacle) => boundsOverlap(bounds, obstacle)) ||
      inlineBounds.some((other) => boundsOverlap(bounds, other))
    ) {
      return true
    }
    if (
      labels.some(
        (other, j) =>
          index !== j &&
          boundsOverlap(bounds, getAnchoredNetLabelRenderedBounds(other)),
      )
    ) {
      return true
    }
    for (const other of allTraces) {
      if (other.globalConnNetId === label.globalConnNetId) continue
      for (let i = 0; i < other.tracePath.length - 1; i++) {
        const segStart = other.tracePath[i]
        const segEnd = other.tracePath[i + 1]
        if (
          segStart &&
          segEnd &&
          segmentIntersectsRect(segStart, segEnd, bounds)
        ) {
          return true
        }
      }
    }
  }
  return false
}
