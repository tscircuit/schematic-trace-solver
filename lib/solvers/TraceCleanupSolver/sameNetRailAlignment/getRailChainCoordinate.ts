import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getTraceConnectedPinComponents } from "lib/solvers/SchematicTraceLinesSolver/getTraceConnectedPinComponents"
import type { PinId } from "lib/types/InputProblem"
import type { RailSegment } from "./types"

export const getRailChainCoordinate = (
  group: RailSegment[],
  traces: SolvedTracePath[],
) => {
  if (new Set(group.map((segment) => segment.componentId)).size < 2) return null
  const groupTraceIds = new Set(group.map((segment) => segment.traceId))
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
  const connectedPinComponents = getTraceConnectedPinComponents({
    pinIds: [...pinDegrees.keys()],
    traces: groupTraces,
  })
  if (connectedPinComponents.length !== 1) return null

  // The first terminal rail anchors every following rail through the chain.
  const firstTerminalTrace = groupTraces.find((trace) =>
    trace.pinIds.includes(terminalPinIds[0]!),
  )!
  return group.find(
    (segment) => segment.traceId === firstTerminalTrace.mspPairId,
  )!.coordinate
}
