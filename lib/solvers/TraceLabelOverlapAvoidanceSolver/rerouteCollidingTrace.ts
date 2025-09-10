import type { InputProblem } from "../../types/InputProblem"
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

const simplifyPath = (path: Point[]): Point[] => {
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
  return newPath
}

/**
 * Finds the start and end indices of the portion of a trace path that is inside a label's bounds.
 */
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

  // NEVER do direct connection - always use L-shaped paths
  const candidateDetours: Point[][] = []

  // L-shaped connections: we need an intermediate point
  if (entryPoint.x !== exitPoint.x && entryPoint.y !== exitPoint.y) {
    // Two possible L-shapes:
    // 1. Horizontal first, then vertical
    candidateDetours.push([{ x: exitPoint.x, y: entryPoint.y }])
    // 2. Vertical first, then horizontal
    candidateDetours.push([{ x: entryPoint.x, y: exitPoint.y }])
  } else if (entryPoint.x === exitPoint.x || entryPoint.y === exitPoint.y) {
    // Already aligned - direct connection is OK (it's a straight line, not diagonal)
    const newPath = [...pathToEntry, ...pathFromExit]
    const simplified = simplifyPath(newPath)
    if (!isPathCollidingWithObstacles(simplified, obstacles)) {
      return { ...initialTrace, tracePath: simplified }
    }
  }

  // Try the simple L-shaped connections first
  for (let i = 0; i < candidateDetours.length; i++) {
    const detour = candidateDetours[i]

    const newFullPath = [...pathToEntry, ...detour, ...pathFromExit]
    const simplified = simplifyPath(newFullPath)

    if (!isPathCollidingWithObstacles(simplified, obstacles)) {
      return { ...initialTrace, tracePath: simplified }
    }
  }

  candidateDetours.length = 0 // Clear array

  // Generate detours that go around the label
  const buffer = 0.1
  const leftX = labelBounds.minX - buffer
  const rightX = labelBounds.maxX + buffer
  const topY = labelBounds.maxY + buffer
  const bottomY = labelBounds.minY - buffer

  // Determine which sides to try based on entry/exit positions
  const entryLeft = entryPoint.x <= labelBounds.minX
  const entryRight = entryPoint.x >= labelBounds.maxX
  const entryAbove = entryPoint.y >= labelBounds.maxY
  const entryBelow = entryPoint.y <= labelBounds.minY

  const exitLeft = exitPoint.x <= labelBounds.minX
  const exitRight = exitPoint.x >= labelBounds.maxX
  const exitAbove = exitPoint.y >= labelBounds.maxY
  const exitBelow = exitPoint.y <= labelBounds.minY

  // Route around left side
  if (
    (entryLeft || exitLeft) &&
    entryPoint.x < labelBounds.maxX &&
    exitPoint.x < labelBounds.maxX
  ) {
    candidateDetours.push([
      { x: leftX, y: entryPoint.y },
      { x: leftX, y: exitPoint.y },
    ])
  }

  // Route around right side
  if (
    (entryRight || exitRight) &&
    entryPoint.x > labelBounds.minX &&
    exitPoint.x > labelBounds.minX
  ) {
    candidateDetours.push([
      { x: rightX, y: entryPoint.y },
      { x: rightX, y: exitPoint.y },
    ])
  }

  // Route around top
  if (
    (entryAbove || exitAbove) &&
    entryPoint.y > labelBounds.minY &&
    exitPoint.y > labelBounds.minY
  ) {
    candidateDetours.push([
      { x: entryPoint.x, y: topY },
      { x: exitPoint.x, y: topY },
    ])
  }

  // Route around bottom
  if (
    (entryBelow || exitBelow) &&
    entryPoint.y < labelBounds.maxY &&
    exitPoint.y < labelBounds.maxY
  ) {
    candidateDetours.push([
      { x: entryPoint.x, y: bottomY },
      { x: exitPoint.x, y: bottomY },
    ])
  }

  // Try each detour
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

/**
 * Attempts to reroute a trace using the simpler 4-point box detour.
 * Returns the new trace path if successful, otherwise null.
 */
const tryFourPointDetour = (
  initialTrace: SolvedTracePath,
  label: NetLabelPlacement,
  labelBounds: any,
  obstacles: any[],
  buffer: number,
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

  if (collidingSegIndex === -1) return initialTrace // Return original if no collision found (shouldn't happen if called as fallback)

  const pA = initialTrace.tracePath[collidingSegIndex]
  const pB = initialTrace.tracePath[collidingSegIndex + 1]

  if (!pA || !pB) return null

  const candidateDetours: Point[][] = []
  const paddedLabelBounds = getRectBounds(
    label.center,
    label.width,
    label.height,
  )

  if (isVertical(pA, pB)) {
    const xCandidates = [
      paddedLabelBounds.maxX + buffer,
      paddedLabelBounds.minX - buffer,
    ]
    for (const newX of xCandidates) {
      candidateDetours.push(
        pB.y > pA.y
          ? [
              { x: pA.x, y: paddedLabelBounds.minY - buffer },
              { x: newX, y: paddedLabelBounds.minY - buffer },
              { x: newX, y: paddedLabelBounds.maxY + buffer },
              { x: pB.x, y: paddedLabelBounds.maxY + buffer },
            ]
          : [
              { x: pA.x, y: paddedLabelBounds.maxY + buffer },
              { x: newX, y: paddedLabelBounds.maxY + buffer },
              { x: newX, y: paddedLabelBounds.minY - buffer },
              { x: pB.x, y: paddedLabelBounds.minY - buffer },
            ],
      )
    }
  } else if (isHorizontal(pA, pB)) {
    const yCandidates = [
      paddedLabelBounds.maxY + buffer,
      paddedLabelBounds.minY - buffer,
    ]
    for (const newY of yCandidates) {
      candidateDetours.push(
        pB.x > pA.x
          ? [
              { x: paddedLabelBounds.minX - buffer, y: pA.y },
              { x: paddedLabelBounds.minX - buffer, y: newY },
              { x: paddedLabelBounds.maxX + buffer, y: newY },
              { x: paddedLabelBounds.maxX + buffer, y: pB.y },
            ]
          : [
              { x: paddedLabelBounds.maxX + buffer, y: pA.y },
              { x: paddedLabelBounds.maxX + buffer, y: newY },
              { x: paddedLabelBounds.minX - buffer, y: newY },
              { x: paddedLabelBounds.minX - buffer, y: pB.y },
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
): SolvedTracePath => {
  const initialTrace = { ...trace, tracePath: simplifyPath(trace.tracePath) }

  if (trace.globalConnNetId === label.globalConnNetId) {
    return initialTrace
  }

  const obstacles = getObstacleRects(problem)
  const buffer = 0.05
  const labelBoundsRaw = getRectBounds(label.center, label.width, label.height)
  const labelBounds = {
    minX: labelBoundsRaw.minX - buffer,
    minY: labelBoundsRaw.minY - buffer,
    maxX: labelBoundsRaw.maxX + buffer,
    maxY: labelBoundsRaw.maxY + buffer,
    chipId: `netlabel-${label.netId}`,
  }

  // --- Strategy 1: Attempt the 4-point detour first ---
  const fourPointResult = tryFourPointDetour(
    initialTrace,
    label,
    labelBounds,
    obstacles,
    buffer,
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

  console.warn(
    `  -> All strategies FAILED for trace ${initialTrace.mspPairId}.`,
  )
  return initialTrace
}
