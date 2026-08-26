import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { PinId } from "lib/types/InputProblem"
import { nearlyEqual } from "./geometry"
import type { RailSegment } from "./types"

interface RailChainAnchor {
  coordinate: number
  componentId: string | null
}

const getSharedComponentPinAnchor = ({
  groupTraces,
  orientation,
  terminalPinIds,
}: {
  groupTraces: SolvedTracePath[]
  orientation: RailSegment["orientation"]
  terminalPinIds: ReadonlySet<PinId>
}) => {
  const seenPinIds = new Set<PinId>()
  const uniquePins = groupTraces.flatMap((trace) =>
    trace.pins.filter((pin) => {
      if (seenPinIds.has(pin.pinId)) return false
      seenPinIds.add(pin.pinId)
      return true
    }),
  )

  let sharedAnchor: RailChainAnchor | null = null
  let sharedPinCount = 1
  const componentIds = new Set(uniquePins.map((pin) => pin.chipId))
  for (const componentId of componentIds) {
    const componentPins = uniquePins.filter((pin) => pin.chipId === componentId)
    if (componentPins.length <= sharedPinCount) continue
    // A shared component edge anchors the rail only when the chain continues
    // through every pin on that edge. Terminal components keep the first-rail
    // anchor so their endpoint geometry is not pulled onto the component body.
    if (componentPins.some((pin) => terminalPinIds.has(pin.pinId))) continue

    const coordinates = componentPins.map((pin) => {
      if (orientation === "horizontal") return pin.y
      return pin.x
    })
    if (
      coordinates.some(
        (coordinate) => !nearlyEqual(coordinate, coordinates[0]!),
      )
    ) {
      continue
    }

    sharedAnchor = { coordinate: coordinates[0]!, componentId }
    sharedPinCount = componentPins.length
  }
  return sharedAnchor
}

export const getRailChainAnchor = (
  group: RailSegment[],
  traces: SolvedTracePath[],
): RailChainAnchor | null => {
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

  const sharedComponentPinAnchor = getSharedComponentPinAnchor({
    groupTraces,
    orientation: group[0]!.orientation,
    terminalPinIds: new Set(terminalPinIds),
  })
  if (sharedComponentPinAnchor !== null) {
    return sharedComponentPinAnchor
  }

  // The first terminal rail anchors every following rail through the chain.
  const firstTerminalTrace = groupTraces.find((trace) =>
    trace.pinIds.includes(terminalPinIds[0]!),
  )!
  return {
    coordinate: group.find(
      (segment) => segment.traceId === firstTerminalTrace.mspPairId,
    )!.coordinate,
    componentId: null,
  }
}

export const getRailChainCoordinate = (
  group: RailSegment[],
  traces: SolvedTracePath[],
) => getRailChainAnchor(group, traces)?.coordinate ?? null
