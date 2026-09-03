import type { InputProblem } from "lib/types/InputProblem"
import { minimizeTurns } from "./turnMinimization"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { countTurns } from "./countTurns"
import {
  getVisibleTraceLength,
  getVisibleTraceSegmentCount,
  RAIL_ALIGNMENT_EPSILON,
} from "./sameNetRailAlignment/geometry"
import { shortenExcessiveLabelPaddingDetour } from "./shortenExcessiveLabelPaddingDetour"

const PATH_LENGTH_EPSILON = 1e-9

const getPathLength = (path: SolvedTracePath["tracePath"]): number =>
  path.slice(1).reduce((length, point, pointIndex) => {
    const previousPoint = path[pointIndex]!
    return (
      length +
      Math.abs(point.x - previousPoint.x) +
      Math.abs(point.y - previousPoint.y)
    )
  }, 0)

const chooseLengthPreservingBoundaryRoute = ({
  strictPath,
  boundaryPath,
}: {
  strictPath: SolvedTracePath["tracePath"]
  boundaryPath: SolvedTracePath["tracePath"]
}) => {
  const doesNotAddTurns = countTurns(boundaryPath) <= countTurns(strictPath)
  const preservesLength =
    Math.abs(getPathLength(boundaryPath) - getPathLength(strictPath)) <=
    PATH_LENGTH_EPSILON

  return doesNotAddTurns && preservesLength ? boundaryPath : strictPath
}

/**
 * Minimizes turns with a strict pass that treats every other trace as an
 * obstacle and a relaxed pass that permits joining endpoint-sharing same-net
 * branches. Equivalent-turn routes are compared by their rendered same-net
 * complexity so aligned rails win without arbitrarily shifting local routes.
 */
export const minimizeTurnsWithFilteredLabels = ({
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
  const originalTargetTrace = traces.find(
    (t) => t.mspPairId === targetMspConnectionPairId,
  )
  if (!originalTargetTrace) {
    throw new Error(`Target trace ${targetMspConnectionPairId} not found`)
  }
  const targetTrace = shortenExcessiveLabelPaddingDetour({
    inputProblem,
    trace: originalTargetTrace,
  })

  const targetPinIds = new Set(targetTrace.pinIds)
  const otherTraces = traces.filter(
    (trace) => trace.mspPairId !== targetMspConnectionPairId,
  )
  const relaxedObstacleTraces = otherTraces.filter((trace) => {
    const sharesEndpoint = trace.pinIds.some((pinId) => targetPinIds.has(pinId))
    return (
      trace.globalConnNetId !== targetTrace.globalConnNetId || !sharesEndpoint
    )
  })

  const TRACE_WIDTH = 0.01
  const getTraceObstacles = (obstacleTraces: SolvedTracePath[]) =>
    obstacleTraces.flatMap((trace, i) =>
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

  const staticObstaclesRaw = getObstacleRects(inputProblem)
  const PADDING = 0.01
  const staticObstacles = staticObstaclesRaw.map((obs) => ({
    ...obs,
    minX: obs.minX - PADDING,
    minY: obs.minY - PADDING,
    maxX: obs.maxX + PADDING,
    maxY: obs.maxY + PADDING,
  }))

  const originalPath = targetTrace.tracePath
  const filteredLabels = allLabelPlacements.filter((label) => {
    const originalNetIds = mergedLabelNetIdMap[label.globalConnNetId]
    if (originalNetIds) {
      return !originalNetIds.has(targetTrace.globalConnNetId)
    }
    return label.globalConnNetId !== targetTrace.globalConnNetId
  })

  const labelBounds = filteredLabels.map((nl) => ({
    minX: nl.center.x - nl.width / 2 - paddingBuffer,
    maxX: nl.center.x + nl.width / 2 + paddingBuffer,
    minY: nl.center.y - nl.height / 2 - paddingBuffer,
    maxY: nl.center.y + nl.height / 2 + paddingBuffer,
  }))

  const minimizeForObstacles = (
    obstacles: ReturnType<typeof getTraceObstacles>,
  ) => {
    const strictPath = minimizeTurns({
      path: originalPath,
      obstacles,
      labelBounds,
      originalPath,
    })
    const boundaryPath = minimizeTurns({
      path: originalPath,
      obstacles,
      labelBounds,
      originalPath,
      allowLabelBoundaryExtension: true,
    })

    return chooseLengthPreservingBoundaryRoute({
      strictPath,
      boundaryPath,
    })
  }

  const strictPath = minimizeForObstacles([
    ...staticObstacles,
    ...getTraceObstacles(otherTraces),
  ])

  const relaxedPath = minimizeForObstacles([
    ...staticObstacles,
    ...getTraceObstacles(relaxedObstacleTraces),
  ])

  const sameNetTraces = otherTraces.filter(
    (trace) => trace.globalConnNetId === targetTrace.globalConnNetId,
  )
  const getSameNetReadability = (tracePath: SolvedTracePath["tracePath"]) => {
    const tracesWithCandidate = [
      ...sameNetTraces,
      { ...targetTrace, tracePath },
    ]
    return {
      segmentCount: getVisibleTraceSegmentCount(tracesWithCandidate),
      visibleLength: getVisibleTraceLength(tracesWithCandidate),
    }
  }

  const strictTurns = countTurns(strictPath)
  const relaxedTurns = countTurns(relaxedPath)
  let newPath = strictPath

  if (relaxedTurns < strictTurns) {
    newPath = relaxedPath
  } else if (relaxedTurns === strictTurns) {
    const strictReadability = getSameNetReadability(strictPath)
    const relaxedReadability = getSameNetReadability(relaxedPath)

    if (
      relaxedReadability.segmentCount < strictReadability.segmentCount ||
      (relaxedReadability.segmentCount === strictReadability.segmentCount &&
        relaxedReadability.visibleLength <
          strictReadability.visibleLength - RAIL_ALIGNMENT_EPSILON)
    ) {
      newPath = relaxedPath
    }
  }

  return {
    ...targetTrace,
    tracePath: newPath,
  }
}
