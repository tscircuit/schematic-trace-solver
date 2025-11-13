import type { Point } from "graphics-debug"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

/**
 * Generates candidate four-point detour paths for a trace colliding with a label obstacle.
 * It uses a two-strategy approach: a simpler one for individual labels and a more robust one
 * for merged labels, finding precise entry and exit points. Detours are U-shaped, respecting
 * the trace's direction to prevent loops.
 */
export const generateFourPointDetourCandidates = ({
  initialTrace,
  label,
  labelBounds,
  paddingBuffer,
  detourCount,
}: {
  initialTrace: SolvedTracePath
  label: NetLabelPlacement
  labelBounds: { minX: number; maxX: number; minY: number; maxY: number }
  paddingBuffer: number
  detourCount: number
}): Point[][] => {
  const isMergedLabel = label.globalConnNetId.startsWith("merged-group-")
  const effectivePadding = paddingBuffer + detourCount * paddingBuffer
  const paddedLabelBounds = {
    minX: labelBounds.minX - effectivePadding,
    maxX: labelBounds.maxX + effectivePadding,
    minY: labelBounds.minY - effectivePadding,
    maxY: labelBounds.maxY + effectivePadding,
  }

  let entryPoint: Point, exitPoint: Point
  let entryIndex: number, exitIndex: number

  const isPointInRect = (p: Point) =>
    p.x >= paddedLabelBounds.minX &&
    p.x <= paddedLabelBounds.maxX &&
    p.y >= paddedLabelBounds.minY &&
    p.y <= paddedLabelBounds.maxY

  if (isMergedLabel) {
    // STRATEGY 2: Merged Label - find first point before and after the entire crossing
    let firstInsideIndex = -1
    for (let i = 0; i < initialTrace.tracePath.length; i++) {
      if (isPointInRect(initialTrace.tracePath[i])) {
        firstInsideIndex = i
        break
      }
    }

    if (firstInsideIndex === -1) return [] // No points inside, shouldn't be called

    entryIndex = Math.max(0, firstInsideIndex - 1)
    entryPoint = initialTrace.tracePath[entryIndex]

    let firstOutsideIndex = -1
    for (let i = firstInsideIndex; i < initialTrace.tracePath.length; i++) {
      if (!isPointInRect(initialTrace.tracePath[i])) {
        firstOutsideIndex = i
        break
      }
    }

    if (firstOutsideIndex === -1) {
      // Trace ends inside the box, use the last point as exit
      exitIndex = initialTrace.tracePath.length - 1
    } else {
      exitIndex = firstOutsideIndex
    }
    exitPoint = initialTrace.tracePath[exitIndex]
  } else {
    // STRATEGY 1: Single Label - find the first intersecting segment
    let collidingSegIndex = -1
    for (let i = 0; i < initialTrace.tracePath.length - 1; i++) {
      if (
        segmentIntersectsRect(
          initialTrace.tracePath[i],
          initialTrace.tracePath[i + 1],
          { ...paddedLabelBounds, chipId: "temp-obstacle" },
        )
      ) {
        collidingSegIndex = i
        break
      }
    }

    if (collidingSegIndex === -1) return []

    entryIndex = collidingSegIndex
    exitIndex = collidingSegIndex + 1
    entryPoint = initialTrace.tracePath[entryIndex]
    exitPoint = initialTrace.tracePath[exitIndex]
  }

  if (!entryPoint || !exitPoint || entryIndex >= exitIndex) return []

  const candidateDetours: Point[][] = []
  const dx = exitPoint.x - entryPoint.x
  const dy = exitPoint.y - entryPoint.y

  if (Math.abs(dx) > Math.abs(dy)) {
    // More horizontal
    const yCandidates = [paddedLabelBounds.maxY, paddedLabelBounds.minY]
    for (const newY of yCandidates) {
      candidateDetours.push(
        dx > 0 // Left-to-right
          ? [
              { x: paddedLabelBounds.minX, y: entryPoint.y },
              { x: paddedLabelBounds.minX, y: newY },
              { x: paddedLabelBounds.maxX, y: newY },
              { x: paddedLabelBounds.maxX, y: exitPoint.y },
            ]
          : [
              // Right-to-left
              { x: paddedLabelBounds.maxX, y: entryPoint.y },
              { x: paddedLabelBounds.maxX, y: newY },
              { x: paddedLabelBounds.minX, y: newY },
              { x: paddedLabelBounds.minX, y: exitPoint.y },
            ],
      )
    }
  } else {
    // More vertical
    const xCandidates = [paddedLabelBounds.maxX, paddedLabelBounds.minX]
    for (const newX of xCandidates) {
      candidateDetours.push(
        dy > 0 // Top-to-bottom
          ? [
              { x: entryPoint.x, y: paddedLabelBounds.minY },
              { x: newX, y: paddedLabelBounds.minY },
              { x: newX, y: paddedLabelBounds.maxY },
              { x: exitPoint.x, y: paddedLabelBounds.maxY },
            ]
          : [
              // Bottom-to-top
              { x: entryPoint.x, y: paddedLabelBounds.maxY },
              { x: newX, y: paddedLabelBounds.maxY },
              { x: newX, y: paddedLabelBounds.minY },
              { x: exitPoint.x, y: paddedLabelBounds.minY },
            ],
      )
    }
  }

  return candidateDetours.map((detourPoints) => [
    ...initialTrace.tracePath.slice(0, entryIndex),
    entryPoint,
    ...detourPoints,
    exitPoint,
    ...initialTrace.tracePath.slice(exitIndex + 1),
  ])
}
