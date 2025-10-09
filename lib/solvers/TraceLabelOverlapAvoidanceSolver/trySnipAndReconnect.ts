import type { Point } from "@tscircuit/math-utils"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isPathCollidingWithObstacles,
  isVertical,
  segmentIntersectsRect,
} from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { simplifyPath } from "./simplifyPath"

export const trySnipAndReconnect = ({
  initialTrace,
  firstInsideIndex,
  lastInsideIndex,
  labelBounds,
  obstacles,
}: {
  initialTrace: SolvedTracePath
  firstInsideIndex: number
  lastInsideIndex: number
  labelBounds: any
  obstacles: any[]
}): SolvedTracePath | null => {
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

export const tryFourPointDetour = ({
  initialTrace,
  label,
  labelBounds,
  obstacles,
  paddingBuffer,
  detourCount,
}: {
  initialTrace: SolvedTracePath
  label: NetLabelPlacement
  labelBounds: any
  obstacles: any[]
  paddingBuffer: number
  detourCount: number
}): SolvedTracePath | null => {
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
