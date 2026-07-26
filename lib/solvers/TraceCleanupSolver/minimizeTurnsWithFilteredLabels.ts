import type { InputProblem } from "../../types/InputProblem"
import type { NetLabelPlacement } from "../../types/NetLabelPlacement"
import type { SolvedTracePath } from "../../types/SolvedTracePath"
import { minimizeTurns } from "./minimizeTurns"
import { getObstacleRects as getObstacleRectsFromProblem } from "./getObstacleRects"

function getObstacleRects(inputProblem: InputProblem) {
  return getObstacleRectsFromProblem(inputProblem)
}

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
  const targetTrace = traces.find((t) => t.mspPairId === targetMspConnectionPairId)
  if (!targetTrace) throw new Error(`Target trace ${targetMspConnectionPairId} not found`)
  const targetPinIds = new Set(targetTrace.pinIds)
  const otherTraces = traces.filter((trace) => trace.mspPairId !== targetMspConnectionPairId)
  const TRACE_WIDTH = 0.01
  const getTraceObstacles = (obstacleTraces: SolvedTracePath[]) =>
    obstacleTraces.flatMap((trace, i) => {
      const path = (trace as any).tracePath ?? (trace as any).path ?? []
      if (!Array.isArray(path) || path.length < 2) return []
      return path.slice(0, -1).map((p1: any, pi: number) => {
        const p2 = path[pi + 1]
        if (!p2) return null
        return {
          chipId: `trace-obstacle-${i}-${pi}`,
          minX: Math.min(p1.x, p2.x) - TRACE_WIDTH / 2,
          minY: Math.min(p1.y, p2.y) - TRACE_WIDTH / 2,
          maxX: Math.max(p1.x, p2.x) + TRACE_WIDTH / 2,
          maxY: Math.max(p1.y, p2.y) + TRACE_WIDTH / 2,
        }
      }).filter(Boolean) as any[]
    })
  const staticObstaclesRaw = getObstacleRects(inputProblem)
  const PADDING = 0.01
  const staticObstacles = staticObstaclesRaw.map((obs) => ({
    ...obs,
    minX: obs.minX - PADDING,
    minY: obs.minY - PADDING,
    maxX: obs.maxX + PADDING,
    maxY: obs.maxY + PADDING,
  }))
  const originalPath = (targetTrace as any).tracePath ?? (targetTrace as any).path ?? []
  const filteredLabels = allLabelPlacements.filter((label) => {
    const originalNetIds = mergedLabelNetIdMap[label.globalConnNetId]
    if (originalNetIds) return !originalNetIds.has(targetTrace.globalConnNetId)
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
    targetMspConnectionPairId,
    traces,
    inputProblem,
    allLabelPlacements,
    mergedLabelNetIdMap,
    paddingBuffer,
  })
  return strictPath
}
