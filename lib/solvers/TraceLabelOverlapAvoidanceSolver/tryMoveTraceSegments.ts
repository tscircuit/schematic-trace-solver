import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { Bounds } from "@tscircuit/math-utils"
import { segmentIntersectsRect } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

export const generateMoveTraceSegmentsCandidates = ({
  initialTrace,
  label,
  labelBounds,
  paddingBuffer,
  detourCount,
}: {
  initialTrace: SolvedTracePath
  label: NetLabelPlacement
  labelBounds: Bounds & { chipId: string }
  paddingBuffer: number
  detourCount: number
}): Point[][] => {
  const candidates: Point[][] = []
  const path = initialTrace.tracePath

  // Only apply to simple traces (2 points = straight line)
  if (path.length !== 2) {
    return []
  }

  const p1 = path[0]
  const p2 = path[1]

  // Only move segments that actually intersect with the label bounds
  if (!segmentIntersectsRect(p1, p2, labelBounds)) {
    return []
  }

  const isHorizontal = p1.y === p2.y

  if (isHorizontal) {
    const newY = labelBounds.maxY + paddingBuffer + label.height / 2
    const newPath = JSON.parse(JSON.stringify(path))
    newPath[0].y = newY
    newPath[1].y = newY
    candidates.push(newPath)
  } else {
    const newX = labelBounds.maxX + paddingBuffer + label.width / 2
    const newPath = JSON.parse(JSON.stringify(path))
    newPath[0].x = newX
    newPath[1].x = newX
    candidates.push(newPath)
  }

  return candidates
}
