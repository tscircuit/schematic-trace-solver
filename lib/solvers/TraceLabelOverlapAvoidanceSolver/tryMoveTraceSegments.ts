import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { Bounds } from "@tscircuit/math-utils"

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

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]
    const p2 = path[i + 1]

    const isHorizontal = p1.y === p2.y

    if (isHorizontal) {
      const newY = labelBounds.maxY + paddingBuffer + label.height / 2
      const newPath = JSON.parse(JSON.stringify(path))
      newPath[i].y = newY
      newPath[i + 1].y = newY
      candidates.push(newPath)
    } else {
      const newX = labelBounds.maxX + paddingBuffer + label.width / 2
      const newPath = JSON.parse(JSON.stringify(path))
      newPath[i].x = newX
      newPath[i + 1].x = newX
      candidates.push(newPath)
    }
  }
  return candidates
}
