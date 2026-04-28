import type { Point } from "graphics-debug"
import type { InputProblem } from "lib/types/InputProblem"
import { simplifyPath } from "./simplifyPath"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"

export const balanceZShapes = ({
  targetMspConnectionPairId,
  traces,
  inputProblem,
  allLabelPlacements,
  mergedLabelNetIdMap,
  paddingBuffer,
}: {
  targetMspConnectionPairId: string
  traces: SolvedTracePath[]
  inputProblem: InputProblem
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
}): SolvedTracePath => {
  const targetTrace = traces.find(
    (t) => t.mspPairId === targetMspConnectionPairId,
  )

  if (!targetTrace) {
    throw new Error(`Target trace ${targetMspConnectionPairId} not found`)
  }

  const TOLERANCE = 1e-5

  const obstacleTraces = traces.filter(
    (t) => t.mspPairId !== targetMspConnectionPairId,
  )

  const TRACE_WIDTH = 0.01
  const traceObstacles = obstacleTraces.flatMap((trace, i) =>
    trace.tracePath.slice(0, -1).map((p1, pi) => {
      const p2 = trace.tracePath[pi + 1]!
      return {
        chipId: `trace-obstacle-${i}-${pi}`,
        minX: Math.min(p1.x, p2.x) - TRACE_WIDTH / 2,
        minY: Math.min(p1.y, p2.y) - TRACE_WIDTH / 2,
        maxX: Math.max(p1.x, p2.x) + TRACE_WIDTH / 2,
        maxY: Math.max(p1.y, p2.y) + TRACE_WIDTH / 2,
      }
    }),
  )

  const staticObstacles = getObstacleRects(inputProblem).map((obs) => ({
    ...obs,
    minX: obs.minX + TOLERANCE,
    maxX: obs.maxX - TOLERANCE,
    minY: obs.minY + TOLERANCE,
    maxY: obs.maxY - TOLERANCE,
  }))

  const combinedObstacles = [...staticObstacles, ...traceObstacles]

  const segmentIntersectsAnyRect = (
    p1: Point,
    p2: Point,
    rects: any[],
  ): boolean => {
    for (const rect of rects) {
      if (segmentIntersectsRect(p1, p2, rect)) {
        return true
      }
    }
    return false
  }

  const filteredLabels = allLabelPlacements.filter((label) => {
    const originalNetIds = mergedLabelNetIdMap[label.globalConnNetId]
    if (originalNetIds) {
      return !originalNetIds.has(targetTrace.globalConnNetId)
    }
    return label.globalConnNetId !== targetTrace.globalConnNetId
  })

  const labelBounds = filteredLabels.map((nl) => ({
    minX: nl.center.x - nl.width / 2 + TOLERANCE,
    maxX: nl.center.x + nl.width / 2 - TOLERANCE,
    minY: nl.center.y - nl.height / 2 + TOLERANCE,
    maxY: nl.center.y + nl.height / 2 - TOLERANCE,
  }))

  const newPath = [...targetTrace.tracePath]

  if (newPath.length < 4) {
    return { ...targetTrace }
  }

  if (newPath.length === 4) {
    const [p0, p1, p2, p3] = newPath
    let p1New: Point
    let p2New: Point

    const isHVHShape = p0.y === p1.y && p1.x === p2.x && p2.y === p3.y

    if (isHVHShape) {
      const idealX = (p0.x + p3.x) / 2
      p1New = { x: idealX, y: p1.y }
      p2New = { x: idealX, y: p2.y }
    } else {
      const idealY = (p0.y + p3.y) / 2
      p1New = { x: p1.x, y: idealY }
      p2New = { x: p2.x, y: idealY }
    }

    const collides =
      segmentIntersectsAnyRect(p0, p1New, combinedObstacles) ||
      segmentIntersectsAnyRect(p1New, p2New, combinedObstacles) ||
      segmentIntersectsAnyRect(p2New, p3, combinedObstacles) ||
      segmentIntersectsAnyRect(p0, p1New, labelBounds) ||
      segmentIntersectsAnyRect(p1New, p2New, labelBounds) ||
      segmentIntersectsAnyRect(p2New, p3, labelBounds)

    if (!collides) {
      newPath[1] = p1New
      newPath[2] = p2New
    }

    return { ...targetTrace, tracePath: simplifyPath(newPath) }
  }

  for (let i = 1; i < newPath.length - 4; i++) {
    const p1 = newPath[i]!
    const p2 = newPath[i + 1]!
    const p3 = newPath[i + 2]!
    const p4 = newPath[i + 3]!

    const isHVHZShape = p1.y === p2.y && p2.x === p3.x && p3.y === p4.y
    const isVHVZShape = p1.x === p2.x && p2.y === p3.y && p3.x === p4.x

    const isCollinearHorizontal =
      p1.y === p2.y && p2.y === p3.y && p3.y === p4.y
    const isCollinearVertical = p1.x === p2.x && p2.x === p3.x && p3.x === p4.x
    const isCollinear = isCollinearHorizontal || isCollinearVertical

    let isSameDirection = false
    if (isHVHZShape) {
      isSameDirection = Math.sign(p2.x - p1.x) === Math.sign(p4.x - p3.x)
    } else if (isVHVZShape) {
      isSameDirection = Math.sign(p2.y - p1.y) === Math.sign(p4.y - p3.y)
    }

    const isValidZShape =
      (isHVHZShape || isVHVZShape) && !isCollinear && isSameDirection

    if (!isValidZShape) {
      continue
    }

    let p2New: Point
    let p3New: Point
    const len1Original = isHVHZShape
      ? Math.abs(p1.x - p2.x)
      : Math.abs(p1.y - p2.y)
    const len2Original = isHVHZShape
      ? Math.abs(p3.x - p4.x)
      : Math.abs(p3.y - p4.y)

    if (Math.abs(len1Original - len2Original) < 0.001) {
      continue
    }

    if (isHVHZShape) {
      const idealX = (p1.x + p4.x) / 2
      p2New = { x: idealX, y: p2.y }
      p3New = { x: idealX, y: p3.y }
    } else {
      const idealY = (p1.y + p4.y) / 2
      p2New = { x: p2.x, y: idealY }
      p3New = { x: p3.x, y: idealY }
    }

    const collides =
      segmentIntersectsAnyRect(p1, p2New, combinedObstacles) ||
      segmentIntersectsAnyRect(p2New, p3New, combinedObstacles) ||
      segmentIntersectsAnyRect(p3New, p4, combinedObstacles) ||
      segmentIntersectsAnyRect(p1, p2New, labelBounds) ||
      segmentIntersectsAnyRect(p2New, p3New, labelBounds) ||
      segmentIntersectsAnyRect(p3New, p4, labelBounds)

    if (!collides) {
      newPath[i + 1] = p2New
      newPath[i + 2] = p3New
      i = 0
    }
  }

  const finalSimplifiedPath = simplifyPath(newPath)
  return {
    ...targetTrace,
    tracePath: finalSimplifiedPath,
  }
}
