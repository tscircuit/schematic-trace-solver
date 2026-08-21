import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { AvailableNetOrientationObstacleIndex } from "./AvailableNetOrientationObstacleIndex"
import { tracePathIntersectsBounds } from "./geometry"

export function doesFixedConnectorPrefixIntersectObstacles(params: {
  firstConnectorTrace: Point[]
  lastConnectorTrace: Point[]
  labelIndex: number
  ignoredLabelIndices: Set<number>
  netLabelPlacements: NetLabelPlacement[]
  obstacleIndex: AvailableNetOrientationObstacleIndex
}) {
  const fixedPrefix = getCommonTracePrefix(
    params.firstConnectorTrace,
    params.lastConnectorTrace,
  )
  if (fixedPrefix.length < 2) return false
  if (params.obstacleIndex.doesTracePathCrossChip(fixedPrefix)) return true

  for (const otherLabelIndex of params.obstacleIndex.getLabelIndicesNearTracePath(
    fixedPrefix,
  )) {
    if (otherLabelIndex === params.labelIndex) continue
    if (params.ignoredLabelIndices.has(otherLabelIndex)) continue
    const otherLabel = params.netLabelPlacements[otherLabelIndex]!
    const otherBounds = getRectBounds(
      otherLabel.center,
      otherLabel.width,
      otherLabel.height,
    )
    if (tracePathIntersectsBounds(fixedPrefix, otherBounds)) return true
  }

  return false
}

function getCommonTracePrefix(firstTrace: Point[], lastTrace: Point[]) {
  const commonPrefix: Point[] = []
  const comparablePointCount = Math.min(firstTrace.length, lastTrace.length)
  for (let pointIndex = 0; pointIndex < comparablePointCount; pointIndex++) {
    const firstPoint = firstTrace[pointIndex]!
    const lastPoint = lastTrace[pointIndex]!
    if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y) break
    commonPrefix.push(firstPoint)
  }
  return commonPrefix
}
