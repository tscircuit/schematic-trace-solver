import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { nearlyEqual } from "./geometry"
import type { RailSegment } from "./types"

type TraceId = SolvedTracePath["mspPairId"]
type PinId = SolvedTracePath["pinIds"][number]

export const getRailChainCoordinate = (
  group: RailSegment[],
  traces: SolvedTracePath[],
) => {
  if (new Set(group.map((segment) => segment.componentId)).size < 2) return null
  const groupTraceIds = new Set<TraceId>(
    group.map((segment) => segment.traceId),
  )
  const groupTraces = traces.filter((trace) =>
    groupTraceIds.has(trace.mspPairId),
  )
  if (groupTraces.length < 2) return null
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
