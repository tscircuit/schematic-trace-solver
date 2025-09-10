import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  isVertical,
  isHorizontal,
  segmentIntersectsRect,
  isPathCollidingWithObstacles,
} from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { getObstacleRects } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { Point } from "@tscircuit/math-utils"
import type { InputProblem } from "lib/types/InputProblem"

export const simplifyPath = (path: Point[]): Point[] => {
  if (path.length < 3) return path
  const newPath: Point[] = [path[0]]
  for (let i = 1; i < path.length - 1; i++) {
    const p1 = newPath[newPath.length - 1]
    const p2 = path[i]
    const p3 = path[i + 1]
    if (
      (isVertical(p1, p2) && isVertical(p2, p3)) ||
      (isHorizontal(p1, p2) && isHorizontal(p2, p3))
    ) {
      continue
    }
    newPath.push(p2)
  }
  newPath.push(path[path.length - 1])

  if (newPath.length < 3) return newPath
  const finalPath: Point[] = [newPath[0]]
  for (let i = 1; i < newPath.length - 1; i++) {
    const p1 = finalPath[finalPath.length - 1]
    const p2 = newPath[i]
    const p3 = newPath[i + 1]
    if (
      (isVertical(p1, p2) && isVertical(p2, p3)) ||
      (isHorizontal(p1, p2) && isHorizontal(p2, p3))
    ) {
      continue
    }
    finalPath.push(p2)
  }
  finalPath.push(newPath[newPath.length - 1])

  return finalPath
}

export const hasCollisions = (
  pathSegments: Point[],
  obstacles: any[],
): boolean => {
  // Check each segment of the path
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const p1 = pathSegments[i]
    const p2 = pathSegments[i + 1]

    // Check collision with each obstacle
    for (const obstacle of obstacles) {
      if (segmentIntersectsRect(p1, p2, obstacle)) {
        return true
      }
    }
  }

  return false
}

const findTraceViolationZone = (
  path: Point[],
  labelBounds: { minX: number; maxX: number; minY: number; maxY: number },
) => {
  const isPointInside = (p: Point) =>
    p.x > labelBounds.minX &&
    p.x < labelBounds.maxX &&
    p.y > labelBounds.minY &&
    p.y < labelBounds.maxY

  let firstInsideIndex = -1
  let lastInsideIndex = -1

  for (let i = 0; i < path.length; i++) {
    if (isPointInside(path[i])) {
      if (firstInsideIndex === -1) {
        firstInsideIndex = i
      }
      lastInsideIndex = i
    }
  }
  return { firstInsideIndex, lastInsideIndex }
}

const trySnipAndReconnect = (
  initialTrace: SolvedTracePath,
  firstInsideIndex: number,
  lastInsideIndex: number,
  labelBounds: any,
  obstacles: any[],
): SolvedTracePath | null => {
  if (
    firstInsideIndex <= 0 ||
    lastInsideIndex >= initialTrace.tracePath.length - 1
  ) {
    return null
  }

  const entryPoint = initialTrace.tracePath[firstInsideIndex - 1]
  const exitPoint = initialTrace.tracePath[lastInsideIndex + 1]

  const pathToEntry = initialTrace.tracePath.slice(0, firstInsideIndex)
  const pathFromExit = initialTrace.tracePath.slice(lastInsideIndex + 1)

  const candidateDetours: Point[][] = []

  if (entryPoint.x !== exitPoint.x && entryPoint.y !== exitPoint.y) {
    candidateDetours.push([{ x: exitPoint.x, y: entryPoint.y }])
    candidateDetours.push([{ x: entryPoint.x, y: exitPoint.y }])
  } else if (entryPoint.x === exitPoint.x || entryPoint.y === exitPoint.y) {
    const newPath = [...pathToEntry, ...pathFromExit]
    const simplified = simplifyPath(newPath)
    if (!isPathCollidingWithObstacles(simplified, obstacles)) {
      return { ...initialTrace, tracePath: simplified }
    }
  }

  for (let i = 0; i < candidateDetours.length; i++) {
    const detour = candidateDetours[i]
    const newFullPath = [...pathToEntry, ...detour, ...pathFromExit]
    const simplified = simplifyPath(newFullPath)

    if (!isPathCollidingWithObstacles(simplified, obstacles)) {
      return { ...initialTrace, tracePath: simplified }
    }
  }

  candidateDetours.length = 0

  const buffer = 0.1
  const leftX = labelBounds.minX - buffer
  const rightX = labelBounds.maxX + buffer
  const topY = labelBounds.maxY + buffer
  const bottomY = labelBounds.minY - buffer

  if (
    (entryPoint.x <= labelBounds.minX || exitPoint.x <= labelBounds.minX) &&
    entryPoint.x < labelBounds.maxX &&
    exitPoint.x < labelBounds.maxX
  ) {
    candidateDetours.push([
      { x: leftX, y: entryPoint.y },
      { x: leftX, y: exitPoint.y },
    ])
  }

  if (
    (entryPoint.x >= labelBounds.maxX || exitPoint.x >= labelBounds.maxX) &&
    entryPoint.x > labelBounds.minX &&
    exitPoint.x > labelBounds.minX
  ) {
    candidateDetours.push([
      { x: rightX, y: entryPoint.y },
      { x: rightX, y: exitPoint.y },
    ])
  }

  if (
    (entryPoint.y >= labelBounds.maxY || exitPoint.y >= labelBounds.maxY) &&
    entryPoint.y > labelBounds.minY &&
    exitPoint.y > labelBounds.minY
  ) {
    candidateDetours.push([
      { x: entryPoint.x, y: topY },
      { x: exitPoint.x, y: topY },
    ])
  }

  if (
    (entryPoint.y <= labelBounds.minY || exitPoint.y <= labelBounds.minY) &&
    entryPoint.y < labelBounds.maxY &&
    exitPoint.y < labelBounds.maxY
  ) {
    candidateDetours.push([
      { x: entryPoint.x, y: bottomY },
      { x: exitPoint.x, y: bottomY },
    ])
  }

  for (let i = 0; i < candidateDetours.length; i++) {
    const detour = candidateDetours[i]
    const newFullPath = [...pathToEntry, ...detour, ...pathFromExit]
    const simplified = simplifyPath(newFullPath)

    if (!isPathCollidingWithObstacles(simplified, obstacles)) {
      return { ...initialTrace, tracePath: simplified }
    }
  }

  return null
}

const tryFourPointDetour = (
  initialTrace: SolvedTracePath,
  label: NetLabelPlacement,
  labelBounds: any,
  obstacles: any[],
  paddingBuffer: number,
  detourCount: number,
): SolvedTracePath | null => {
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

  if (collidingSegIndex === -1) return initialTrace

  const pA = initialTrace.tracePath[collidingSegIndex]
  const pB = initialTrace.tracePath[collidingSegIndex + 1]

  if (!pA || !pB) return null

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
  } else if (isHorizontal(pA, pB)) {
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

  for (const detourPoints of candidateDetours) {
    const finalPath = [
      ...initialTrace.tracePath.slice(0, collidingSegIndex + 1),
      ...detourPoints,
      ...initialTrace.tracePath.slice(collidingSegIndex + 1),
    ]
    const simplifiedFinalPath = simplifyPath(finalPath)
    if (!isPathCollidingWithObstacles(simplifiedFinalPath, obstacles)) {
      return { ...initialTrace, tracePath: simplifiedFinalPath }
    }
  }
  return null
}

export const rerouteCollidingTrace = (
  trace: SolvedTracePath,
  label: NetLabelPlacement,
  problem: InputProblem,
  paddingBuffer: number,
  detourCount: number,
): SolvedTracePath => {
  const initialTrace = { ...trace, tracePath: simplifyPath(trace.tracePath) }

  if (trace.globalConnNetId === label.globalConnNetId) {
    return initialTrace
  }

  const obstacles = getObstacleRects(problem)
  const labelPadding = paddingBuffer
  const labelBoundsRaw = getRectBounds(label.center, label.width, label.height)
  const labelBounds = {
    minX: labelBoundsRaw.minX - labelPadding,
    minY: labelBoundsRaw.minY - labelPadding,
    maxX: labelBoundsRaw.maxX + labelPadding,
    maxY: labelBoundsRaw.maxY + labelPadding,
    chipId: `netlabel-${label.netId}`,
  }

  const fourPointResult = tryFourPointDetour(
    initialTrace,
    label,
    labelBounds,
    obstacles,
    paddingBuffer,
    detourCount,
  )
  if (fourPointResult) {
    initialTrace.tracePath = fourPointResult.tracePath
  }
  const { firstInsideIndex, lastInsideIndex } = findTraceViolationZone(
    initialTrace.tracePath,
    labelBounds,
  )

  const snipReconnectResult = trySnipAndReconnect(
    initialTrace,
    firstInsideIndex,
    lastInsideIndex,
    labelBounds,
    obstacles,
  )

  if (snipReconnectResult) {
    return snipReconnectResult
  }

  if (fourPointResult) {
    return fourPointResult
  }

  return initialTrace
}
