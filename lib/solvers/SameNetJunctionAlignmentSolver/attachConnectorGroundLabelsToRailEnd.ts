import type { Point } from "@tscircuit/math-utils"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { getRemovableRailLabelConnectors } from "lib/solvers/RailNetLabelCornerPlacementSolver/getRemovableRailLabelConnectors"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import {
  isVertical,
  RAIL_ALIGNMENT_EPSILON,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"
import { getGroundNetIds } from "lib/utils/getGroundNetIds"
import {
  getClearGroundLabelCenter,
  getLowestConnectedColumnY,
  hasSharedGroundRail,
} from "./groundRailLabelPlacement"

/**
 * Move a shared ground label from its dedicated connector stub to the lower
 * end of the rail the stub branches from, and drop the stub.
 *
 * Orientation placement can hang a ground symbol off a pin stub before the
 * rail's pairwise traces are aligned into one column. Once junction alignment
 * joins them, the rail's lower end is the clear place for the symbol.
 */
export const attachConnectorGroundLabelsToRailEnd = ({
  inputProblem,
  traces,
  netLabelPlacements,
  netLabelConnectorTraceIds,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  netLabelConnectorTraceIds: ReadonlySet<MspConnectionPairId>
}): { traces: SolvedTracePath[]; netLabelPlacements: NetLabelPlacement[] } => {
  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
  const groundNetIds = getGroundNetIds(inputProblem, netConnMap)
  if (groundNetIds.size === 0) return { traces, netLabelPlacements }
  const obstacles = getObstacleRects(inputProblem)
  let outputTraces = traces
  const output = [...netLabelPlacements]

  for (let index = 0; index < output.length; index++) {
    const label = output[index]!
    if (label.orientation !== "y-" || !groundNetIds.has(label.globalConnNetId))
      continue
    if (!hasSharedGroundRail(inputProblem, netConnMap, label.globalConnNetId))
      continue

    // Only stubs whose removal keeps every pin, branch, and other label on
    // the rail can be dropped.
    const attachments = getRemovableRailLabelConnectors({
      label,
      traces: outputTraces,
      rails: outputTraces,
      netLabelPlacements: output,
      netLabelConnectorTraceIds,
      inputProblem,
    })
    for (const { connector, rail } of attachments) {
      const retainedTraces = outputTraces.filter(
        (trace) => trace.mspPairId !== connector.mspPairId,
      )
      const anchorPoint = getRailLowerEnd({
        rail,
        traces: retainedTraces,
        netLabelConnectorTraceIds,
      })
      if (
        !anchorPoint ||
        anchorPoint.y >= label.anchorPoint.y - RAIL_ALIGNMENT_EPSILON
      )
        continue
      const hostTrace = retainedTraces.find(
        (trace) =>
          trace.globalConnNetId === label.globalConnNetId &&
          !netLabelConnectorTraceIds.has(trace.mspPairId) &&
          tracePathContainsPoint(trace.tracePath, anchorPoint),
      )
      if (!hostTrace) continue

      const center = getClearGroundLabelCenter({
        label,
        labelIndex: index,
        anchorPoint,
        obstacles,
        traceMap: Object.fromEntries(
          retainedTraces.map((trace) => [trace.mspPairId, trace]),
        ),
        netLabelPlacements: output,
      })
      if (!center) continue

      output[index] = {
        ...label,
        anchorPoint,
        center,
        mspConnectionPairIds: [hostTrace.mspPairId],
        pinIds: [...hostTrace.pinIds],
      }
      outputTraces = retainedTraces
      break
    }
  }

  return { traces: outputTraces, netLabelPlacements: output }
}

/** Lowest end of the vertical columns the rail runs along, if any. */
const getRailLowerEnd = ({
  rail,
  traces,
  netLabelConnectorTraceIds,
}: {
  rail: SolvedTracePath
  traces: SolvedTracePath[]
  netLabelConnectorTraceIds: ReadonlySet<MspConnectionPairId>
}): Point | null => {
  const railTraces = traces.filter(
    (trace) => !netLabelConnectorTraceIds.has(trace.mspPairId),
  )
  const path = simplifyPath(rail.tracePath)
  let lowerEnd: Point | null = null
  for (let index = 1; index < path.length; index++) {
    const start = path[index - 1]!
    const end = path[index]!
    if (!isVertical(start, end)) continue
    const y = getLowestConnectedColumnY({
      traces: railTraces,
      globalConnNetId: rail.globalConnNetId,
      x: start.x,
      startY: Math.max(start.y, end.y),
    })
    if (!lowerEnd || y < lowerEnd.y) lowerEnd = { x: start.x, y }
  }
  return lowerEnd
}
