import type { InputProblem } from "lib/types/InputProblem"
import { minimizeTurns } from "./turnMinimization"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"

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

  const staticObstacles = getObstacleRects(inputProblem)
  const combinedObstacles = [...staticObstacles, ...traceObstacles]

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

  const newPath = minimizeTurns({
    path: originalPath,
    obstacles: combinedObstacles,
    labelBounds,
  })

  return {
    ...targetTrace,
    tracePath: newPath,
  }
}
