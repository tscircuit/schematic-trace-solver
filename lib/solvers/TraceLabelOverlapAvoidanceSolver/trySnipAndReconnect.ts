import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export const generateSnipAndReconnectCandidates = ({
  initialTrace,
  firstInsideIndex,
  lastInsideIndex,
  labelBounds,
  paddingBuffer,
  detourCount,
  allowSpanningDetours = false,
}: {
  initialTrace: SolvedTracePath
  firstInsideIndex: number
  lastInsideIndex: number
  labelBounds: any
  paddingBuffer: number
  detourCount: number
  allowSpanningDetours?: boolean
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

  const isFourPointSameSideLoop =
    allowSpanningDetours &&
    firstInsideIndex === 2 &&
    lastInsideIndex === 1 &&
    initialTrace.tracePath.length === 4 &&
    initialTrace.pins.length === 2 &&
    initialTrace.pins[0]?.chipId === initialTrace.pins[1]?.chipId
  const spansVertically =
    isFourPointSameSideLoop &&
    Math.abs(initialTrace.pins[0]!.x - initialTrace.pins[1]!.x) < 1e-6 &&
    Math.abs(entryPoint.x - initialTrace.tracePath[0]!.x) <= 0.1 + 1e-6 &&
    Math.abs(entryPoint.x - exitPoint.x) < 1e-6 &&
    ((entryPoint.y <= labelBounds.minY && exitPoint.y >= labelBounds.maxY) ||
      (exitPoint.y <= labelBounds.minY && entryPoint.y >= labelBounds.maxY))
  const spansHorizontally =
    isFourPointSameSideLoop &&
    Math.abs(initialTrace.pins[0]!.y - initialTrace.pins[1]!.y) < 1e-6 &&
    Math.abs(entryPoint.y - initialTrace.tracePath[0]!.y) <= 0.1 + 1e-6 &&
    Math.abs(entryPoint.y - exitPoint.y) < 1e-6 &&
    ((entryPoint.x <= labelBounds.minX && exitPoint.x >= labelBounds.maxX) ||
      (exitPoint.x <= labelBounds.minX && entryPoint.x >= labelBounds.maxX))

  if (
    ((entryPoint.x <= labelBounds.minX || exitPoint.x <= labelBounds.minX) &&
      entryPoint.x < labelBounds.maxX &&
      exitPoint.x < labelBounds.maxX) ||
    spansVertically
  ) {
    allCandidateDetours.push([
      { x: leftX, y: entryPoint.y },
      { x: leftX, y: exitPoint.y },
    ])
  }

  if (
    ((entryPoint.x >= labelBounds.maxX || exitPoint.x >= labelBounds.maxX) &&
      entryPoint.x > labelBounds.minX &&
      exitPoint.x > labelBounds.minX) ||
    spansVertically
  ) {
    allCandidateDetours.push([
      { x: rightX, y: entryPoint.y },
      { x: rightX, y: exitPoint.y },
    ])
  }

  if (
    ((entryPoint.y >= labelBounds.maxY || exitPoint.y >= labelBounds.maxY) &&
      entryPoint.y > labelBounds.minY &&
      exitPoint.y > labelBounds.minY) ||
    spansHorizontally
  ) {
    allCandidateDetours.push([
      { x: entryPoint.x, y: topY },
      { x: exitPoint.x, y: topY },
    ])
  }

  if (
    ((entryPoint.y <= labelBounds.minY || exitPoint.y <= labelBounds.minY) &&
      entryPoint.y < labelBounds.maxY &&
      exitPoint.y < labelBounds.maxY) ||
    spansHorizontally
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
