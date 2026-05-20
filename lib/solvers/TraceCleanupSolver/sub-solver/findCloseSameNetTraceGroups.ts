import type { SolvedTracePath } from "../../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export interface CloseSameNetTraceGroup {
  netId: string
  traceIds: string[]
  maxEndpointDistance: number
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y)

const getTraceEndpoints = (trace: SolvedTracePath) => {
  const start = trace.tracePath[0]
  const end = trace.tracePath[trace.tracePath.length - 1]
  return { start, end }
}

/**
 * Finds same-net traces whose endpoints are already close enough that they are
 * likely candidates for a later merge/join phase.
 *
 * This is intentionally conservative: it does not mutate paths, it only groups
 * traces so the pipeline can decide whether to combine them.
 */
export const findCloseSameNetTraceGroups = (
  traces: SolvedTracePath[],
  maxEndpointDistance = 0.5,
): CloseSameNetTraceGroup[] => {
  const groupedByNet = new Map<string, SolvedTracePath[]>()

  for (const trace of traces) {
    const netId = trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId
    const current = groupedByNet.get(netId) ?? []
    current.push(trace)
    groupedByNet.set(netId, current)
  }

  const groups: CloseSameNetTraceGroup[] = []

  for (const [netId, netTraces] of groupedByNet.entries()) {
    if (netTraces.length < 2) continue

    for (let i = 0; i < netTraces.length; i++) {
      for (let j = i + 1; j < netTraces.length; j++) {
        const left = netTraces[i]
        const right = netTraces[j]
        const a = getTraceEndpoints(left)
        const b = getTraceEndpoints(right)

        const distances = [
          distance(a.start, b.start),
          distance(a.start, b.end),
          distance(a.end, b.start),
          distance(a.end, b.end),
        ]
        const minDistance = Math.min(...distances)

        if (minDistance <= maxEndpointDistance) {
          groups.push({
            netId,
            traceIds: [left.mspPairId as string, right.mspPairId as string],
            maxEndpointDistance: minDistance,
          })
        }
      }
    }
  }

  return groups.sort((a, b) => a.maxEndpointDistance - b.maxEndpointDistance)
}
