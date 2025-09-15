import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { getObstacleRects } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import { findTraceViolationZone } from "./violation"
import { tryFourPointDetour, trySnipAndReconnect } from "./trySnipAndReconnect"
import { simplifyPath } from "./simplifyPath"

export const rerouteCollidingTrace = ({
  trace,
  label,
  problem,
  paddingBuffer,
  detourCount,
}: {
  trace: SolvedTracePath
  label: NetLabelPlacement
  problem: InputProblem
  paddingBuffer: number
  detourCount: number
}): SolvedTracePath => {
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

  const fourPointResult = tryFourPointDetour({
    initialTrace,
    label,
    labelBounds,
    obstacles,
    paddingBuffer,
    detourCount,
  })
  if (fourPointResult) {
    initialTrace.tracePath = fourPointResult.tracePath
  }
  const { firstInsideIndex, lastInsideIndex } = findTraceViolationZone(
    initialTrace.tracePath,
    labelBounds,
  )

  const snipReconnectResult = trySnipAndReconnect({
    initialTrace,
    firstInsideIndex,
    lastInsideIndex,
    labelBounds,
    obstacles,
  })

  if (snipReconnectResult) {
    return snipReconnectResult
  }

  if (fourPointResult) {
    return fourPointResult
  }

  return initialTrace
}
