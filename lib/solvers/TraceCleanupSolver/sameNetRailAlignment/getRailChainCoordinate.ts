import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { PinId } from "lib/types/InputProblem"
import { nearlyEqual } from "./geometry"
import type { RailSegment } from "./types"

export const getRailChainCoordinate = (
  group: RailSegment[],
  traces: SolvedTracePath[],
) => {
  if (new Set(group.map((segment) => segment.componentId)).size < 2) return null
  const groupTraceIds = new Set<MspConnectionPairId>(
    group.map((segment) => segment.traceId),
  )
  const groupTraces = traces.filter((trace) =>
    groupTraceIds.has(trace.mspPairId),
  )
  if (groupTraces.length < 2) return null

  // A rail chain has two terminals and no pin with more than two connections.
  const pinDegrees = new Map<PinId, number>()
  for (const trace of groupTraces) {
    if (trace.pinIds.length !== 2) return null
    for (const pinId of trace.pinIds) {
      pinDegrees.set(pinId, (pinDegrees.get(pinId) ?? 0) + 1)
    }
  }
  const terminalPinIds = [...pinDegrees]
    .filter(([, degree]) => degree === 1)
    .map(([pinId]) => pinId)
  if (terminalPinIds.length !== 2) return null
  if ([...pinDegrees.values()].some((degree) => degree > 2)) return null

  // Walking terminal-to-terminal must consume every trace, rejecting cycles.
  const remainingTraceIds = new Set(groupTraceIds)
  let currentPinId = terminalPinIds[0]!
  while (remainingTraceIds.size > 0) {
    const nextTraces = groupTraces.filter(
      (trace) =>
        remainingTraceIds.has(trace.mspPairId) &&
        trace.pinIds.includes(currentPinId),
    )
    if (nextTraces.length !== 1) return null
    const nextTrace = nextTraces[0]!
    remainingTraceIds.delete(nextTrace.mspPairId)
    currentPinId = nextTrace.pinIds.find((pinId) => pinId !== currentPinId)!
  }
  if (currentPinId !== terminalPinIds[1]) return null

  // Matching terminal rails provide the alignment coordinate for the chain.
  const terminalCoordinates = terminalPinIds.map((pinId) => {
    const terminalTrace = groupTraces.find((trace) =>
      trace.pinIds.includes(pinId),
    )!
    return group.find((segment) => segment.traceId === terminalTrace.mspPairId)!
      .coordinate
  })
  if (!nearlyEqual(terminalCoordinates[0]!, terminalCoordinates[1]!)) {
    return null
  }
  return terminalCoordinates[0]!
}
