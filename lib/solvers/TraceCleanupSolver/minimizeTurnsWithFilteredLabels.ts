import type { InputProblem } from "lib/types/InputProblem"
import { minimizeTurns } from "./turnMinimization"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { countTurns } from "./countTurns"

/**
 * Minimizes turns with a strict pass that treats every other trace as an
 * obstacle and a relaxed pass that permits joining endpoint-sharing same-net
 * branches. The relaxed route wins only when it removes more turns, preserving
 * useful same-net alignment constraints for equivalent routes.
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
  const targetTrace = traces.find(
    (t) => t.mspPairId === targetMspConnectionPairId,
  )
  if (!targetTrace) {
    throw new Error(`Target trace ${targetMspConnectionPairId} not found`)
  }

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

  const strictPath = minimizeTurns({
    path: originalPath,
    obstacles: [...staticObstacles, ...getTraceObstacles(otherTraces)],
    labelBounds,
    originalPath: originalPath,
  })

  const relaxedPath = minimizeTurns({
    path: originalPath,
    obstacles: [
      ...staticObstacles,
      ...getTraceObstacles(relaxedObstacleTraces),
    ],
    labelBounds,
    originalPath: originalPath,
  })

  // Same-net branches are safe to join, but they still provide useful visual
  // alignment constraints. Only relax them when doing so actually removes a
  // turn; otherwise keep the strict route to avoid arbitrarily shifting rails.
  const newPath =
    countTurns(relaxedPath) < countTurns(strictPath) ? relaxedPath : strictPath

  return {
    ...targetTrace,
    tracePath: newPath,
  }
}
