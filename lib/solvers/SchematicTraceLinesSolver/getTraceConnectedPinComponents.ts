import type { SolvedTracePath } from "./SchematicTraceLinesSolver"
import type { PinId } from "lib/types/InputProblem"

export interface TraceConnectedPinComponent {
  pinIds: PinId[]
  traces: SolvedTracePath[]
}

/**
 * Partitions pins into connected components using solved traces as graph edges.
 * Pins without a solved trace are returned as singleton components.
 */
export const getTraceConnectedPinComponents = ({
  pinIds,
  traces,
}: {
  pinIds: PinId[]
  traces: SolvedTracePath[]
}): TraceConnectedPinComponent[] => {
  const adjacency = new Map<PinId, Set<PinId>>()
  for (const pinId of pinIds) adjacency.set(pinId, new Set())

  const relevantTraces = traces.filter((trace) => {
    if (trace.pins.length !== 2) return false
    const [firstPin, secondPin] = trace.pins
    return adjacency.has(firstPin.pinId) && adjacency.has(secondPin.pinId)
  })
  for (const trace of relevantTraces) {
    const [firstPin, secondPin] = trace.pins
    adjacency.get(firstPin.pinId)!.add(secondPin.pinId)
    adjacency.get(secondPin.pinId)!.add(firstPin.pinId)
  }

  const components: TraceConnectedPinComponent[] = []
  const visited = new Set<PinId>()
  for (const pinId of pinIds) {
    if (visited.has(pinId)) continue
    const componentPinIds: PinId[] = []
    const pending = [pinId]
    visited.add(pinId)
    while (pending.length > 0) {
      const currentPinId = pending.pop()!
      componentPinIds.push(currentPinId)
      for (const adjacentPinId of adjacency.get(currentPinId) ?? []) {
        if (visited.has(adjacentPinId)) continue
        visited.add(adjacentPinId)
        pending.push(adjacentPinId)
      }
    }

    const componentPinIdSet = new Set(componentPinIds)
    components.push({
      pinIds: componentPinIds,
      traces: relevantTraces.filter((trace) =>
        trace.pins.every((pin) => componentPinIdSet.has(pin.pinId)),
      ),
    })
  }
  return components
}
