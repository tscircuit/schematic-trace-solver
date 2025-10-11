import type { Point } from "graphics-debug"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  segmentIntersectsRect,
  isVertical,
} from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

export const generateFourPointDetourCandidates = ({
  initialTrace,
  label,
  labelBounds,
  paddingBuffer,
  detourCount,
}: {
  initialTrace: SolvedTracePath
  label: NetLabelPlacement
  labelBounds: any
  paddingBuffer: number
  detourCount: number
}): Point[][] => {
  let collidingSegIndex = -1
  for (let i = 0; i < initialTrace.tracePath.length - 1; i++) {
    if (
      segmentIntersectsRect(
        initialTrace.tracePath[i],
        initialTrace.tracePath[i + 1],
        labelBounds,
      )
    ) {
      collidingSegIndex = i
      break
    }
  }

  if (collidingSegIndex === -1) return []

  const pA = initialTrace.tracePath[collidingSegIndex]
  const pB = initialTrace.tracePath[collidingSegIndex + 1]

  if (!pA || !pB) return []

  const candidateDetours: Point[][] = []
  const paddedLabelBounds = getRectBounds(
    label.center,
    label.width,
    label.height,
  )

  const effectivePadding = paddingBuffer + detourCount * paddingBuffer

  if (isVertical(pA, pB)) {
    const xCandidates = [
      paddedLabelBounds.maxX + effectivePadding,
      paddedLabelBounds.minX - effectivePadding,
    ]
    for (const newX of xCandidates) {
      candidateDetours.push(
        pB.y > pA.y
          ? [
              { x: pA.x, y: paddedLabelBounds.minY - effectivePadding },
              { x: newX, y: paddedLabelBounds.minY - effectivePadding },
              { x: newX, y: paddedLabelBounds.maxY + effectivePadding },
              { x: pB.x, y: paddedLabelBounds.maxY + effectivePadding },
            ]
          : [
              { x: pA.x, y: paddedLabelBounds.maxY + effectivePadding },
              { x: newX, y: paddedLabelBounds.maxY + effectivePadding },
              { x: newX, y: paddedLabelBounds.minY - effectivePadding },
              { x: pB.x, y: paddedLabelBounds.minY - effectivePadding },
            ],
      )
    }
  } else {
    const yCandidates = [
      paddedLabelBounds.maxY + effectivePadding,
      paddedLabelBounds.minY - effectivePadding,
    ]
    for (const newY of yCandidates) {
      candidateDetours.push(
        pB.x > pA.x
          ? [
              { x: paddedLabelBounds.minX - effectivePadding, y: pA.y },
              { x: paddedLabelBounds.minX - effectivePadding, y: newY },
              { x: paddedLabelBounds.maxX + effectivePadding, y: newY },
              { x: paddedLabelBounds.maxX + effectivePadding, y: pB.y },
            ]
          : [
              { x: paddedLabelBounds.maxX + effectivePadding, y: pA.y },
              { x: paddedLabelBounds.maxX + effectivePadding, y: newY },
              { x: paddedLabelBounds.minX - effectivePadding, y: newY },
              { x: paddedLabelBounds.minX - effectivePadding, y: pB.y },
            ],
      )
    }
  }

  return candidateDetours.map((detourPoints) => [
    ...initialTrace.tracePath.slice(0, collidingSegIndex + 1),
    ...detourPoints,
    ...initialTrace.tracePath.slice(collidingSegIndex + 1),
  ])
}
