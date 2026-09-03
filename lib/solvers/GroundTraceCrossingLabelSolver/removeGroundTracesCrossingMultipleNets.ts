import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"
import type { InputProblem } from "lib/types/InputProblem"

const MIN_CROSSED_NET_COUNT = 2

export const removeGroundTracesCrossingMultipleNets = ({
  inputProblem,
  traces,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
}) => {
  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
  const groundGlobalNetIds = new Set(
    inputProblem.netConnections
      .filter((connection) => connection.isGround)
      .flatMap((connection) => {
        const globalNetId = netConnMap.getNetConnectedToId(connection.netId)
        if (!globalNetId) return []
        return [globalNetId]
      }),
  )
  const directConnectionPinPairs = inputProblem.directConnections.map(
    (connection) => new Set(connection.pinIds),
  )
  const removedGroundTraceIds = new Set<string>()

  const outputTraces = traces.filter((trace) => {
    if (!groundGlobalNetIds.has(trace.globalConnNetId)) return true

    const tracePinIds = new Set(trace.pins.map((pin) => pin.pinId))
    const isExplicitConnection = directConnectionPinPairs.some(
      (pinPair) =>
        pinPair.size === tracePinIds.size &&
        [...pinPair].every((pinId) => tracePinIds.has(pinId)),
    )
    if (isExplicitConnection) return true

    const crossedNetIds = new Set<string>()
    for (const otherTrace of traces) {
      if (otherTrace.globalConnNetId === trace.globalConnNetId) continue
      const crossesTrace =
        findPerpendicularPathCrossings(trace.tracePath, otherTrace.tracePath, {
          includeTerminalSegments: true,
        }).length > 0
      if (crossesTrace) crossedNetIds.add(otherTrace.globalConnNetId)
      if (crossedNetIds.size >= MIN_CROSSED_NET_COUNT) break
    }
    if (crossedNetIds.size < MIN_CROSSED_NET_COUNT) return true

    removedGroundTraceIds.add(trace.mspPairId)
    return false
  })

  return { outputTraces, removedGroundTraceIds }
}
