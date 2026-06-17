import type { NetLabelPlacement } from "../../../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "../../../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "graphics-debug"
import { distance } from "@tscircuit/math-utils"

/**
 * Filters a list of labels, returning only those that are physically located
 * near the start or end point of any trace.
 *
 * This is hack so we do not need to know the position of ports
 * and using only the trace geometry. we find out which labels are
 * at/near port of chips and only keep those for merging.
 */
export const filterLabelsAtTraceEdges = ({
  labels,
  traces,
  distanceThreshold = 0.5, // Example threshold
}: {
  labels: NetLabelPlacement[]
  traces: SolvedTracePath[]
  distanceThreshold?: number
}): NetLabelPlacement[] => {
  // 1. Group traces by their net ID for efficient lookup
  const tracesByNetId = new Map<string, SolvedTracePath[]>()
  if (!traces) {
    throw new Error("No traces provided to filterLabelsAtTraceEdges")
  }
  for (const trace of traces) {
    if (!trace.globalConnNetId) continue
    if (!tracesByNetId.has(trace.globalConnNetId)) {
      tracesByNetId.set(trace.globalConnNetId, [])
    }
    tracesByNetId.get(trace.globalConnNetId)!.push(trace)
  }

  const filteredLabels: NetLabelPlacement[] = []

  // 2. Iterate through labels and check proximity against only relevant traces
  for (const label of labels) {
    // Check if it's a port-only label (no associated MSP connection pairs)
    if (label.mspConnectionPairIds.length === 0) {
      filteredLabels.push(label)
      continue // Skip trace-edge checks for port-only labels
    }

    const relevantTraces = tracesByNetId.get(label.globalConnNetId)
    let isNearTraceEdge = false

    if (!relevantTraces || relevantTraces.length === 0) {
      continue
    }

    for (const trace of relevantTraces) {
      if (trace.tracePath.length === 0) continue

      const startPoint = trace.tracePath[0]
      const endPoint = trace.tracePath[trace.tracePath.length - 1]

      const startDist = distance(label.center, startPoint)
      const endDist = distance(label.center, endPoint)

      if (startDist <= distanceThreshold || endDist <= distanceThreshold) {
        isNearTraceEdge = true
        break // Found a nearby edge, no need to check other traces for this label
      }
    }

    if (isNearTraceEdge) {
      filteredLabels.push(label)
    }
  }

  return filteredLabels
}
