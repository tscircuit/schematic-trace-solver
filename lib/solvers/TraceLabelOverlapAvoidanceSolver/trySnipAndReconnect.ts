import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export const generateSnipAndReconnectCandidates = ({
  initialTrace,
  firstInsideIndex,
  lastInsideIndex,
  labelBounds,
  paddingBuffer,
  detourCount,
}: {
  initialTrace: SolvedTracePath
  firstInsideIndex: number
  lastInsideIndex: number
  labelBounds: any
  paddingBuffer: number
  detourCount: number
}): Point[][] => {
  if (
    firstInsideIndex <= 0 ||
    lastInsideIndex >= initialTrace.tracePath.length - 1
  ) {
    return []
  }

  const entryPoint = initialTrace.tracePath[firstInsideIndex - 1]
  const exitPoint = initialTrace.tracePath[lastInsideIndex + 1]

  const pathToEntry = initialTrace.tracePath.slice(0, firstInsideIndex)
  const pathFromExit = initialTrace.tracePath.slice(lastInsideIndex + 1)

  const allCandidateDetours: Point[][] = []

  // Candidate type 1: simple elbow
  if (entryPoint.x !== exitPoint.x && entryPoint.y !== exitPoint.y) {
    allCandidateDetours.push([{ x: exitPoint.x, y: entryPoint.y }])
    allCandidateDetours.push([{ x: entryPoint.x, y: exitPoint.y }])
  } else if (entryPoint.x === exitPoint.x || entryPoint.y === exitPoint.y) {
    // Candidate type 2: direct connection (if points are aligned)
    allCandidateDetours.push([]) // No detour points needed
  }

  // Candidate type 3: routing around the label bounds
  const buffer = paddingBuffer + detourCount * paddingBuffer
  const leftX = labelBounds.minX - buffer
  const rightX = labelBounds.maxX + buffer
  const topY = labelBounds.maxY + buffer
  const bottomY = labelBounds.minY - buffer

  if (
    (entryPoint.x <= labelBounds.minX || exitPoint.x <= labelBounds.minX) &&
    entryPoint.x < labelBounds.maxX &&
    exitPoint.x < labelBounds.maxX
  ) {
    allCandidateDetours.push([
      { x: leftX, y: entryPoint.y },
      { x: leftX, y: exitPoint.y },
    ])
  }

  if (
    (entryPoint.x >= labelBounds.maxX || exitPoint.x >= labelBounds.maxX) &&
    entryPoint.x > labelBounds.minX &&
    exitPoint.x > labelBounds.minX
  ) {
    allCandidateDetours.push([
      { x: rightX, y: entryPoint.y },
      { x: rightX, y: exitPoint.y },
    ])
  }

  if (
    (entryPoint.y >= labelBounds.maxY || exitPoint.y >= labelBounds.maxY) &&
    entryPoint.y > labelBounds.minY &&
    exitPoint.y > labelBounds.minY
  ) {
    allCandidateDetours.push([
      { x: entryPoint.x, y: topY },
      { x: exitPoint.x, y: topY },
    ])
  }

  if (
    (entryPoint.y <= labelBounds.minY || exitPoint.y <= labelBounds.minY) &&
    entryPoint.y < labelBounds.maxY &&
    exitPoint.y < labelBounds.maxY
  ) {
    allCandidateDetours.push([
      { x: entryPoint.x, y: bottomY },
      { x: exitPoint.x, y: bottomY },
    ])
  }

  return allCandidateDetours.map((detour) => [
    ...pathToEntry,
    ...detour,
    ...pathFromExit,
  ])
}
