import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Merge distance threshold for considering two parallel same-net segments as
 * candidates for merging.
 */
const MERGE_DISTANCE_THRESHOLD = 0.15

/**
 * Resolves the effective net id for a trace, taking into account merged label net ids.
 */
function getEffectiveNetId(
  trace: SolvedTracePath,
  mergedLabelNetIdMap: Record<string, Set<string>>,
): string {
  const netId = trace.globalConnNetId ?? trace.mspPairId
  for (const [key, set] of Object.entries(mergedLabelNetIdMap)) {
    if (set.has(netId)) return key
  }
  return netId
}

/**
 * Represents a single segment extracted from a trace path.
 */
interface TraceSegment {
  traceId: string
  segIndex: number
  x1: number
  y1: number
  x2: number
  y2: number
  orientation: "horizontal" | "vertical"
}

/**
 * Extract all horizontal and vertical segments from a trace path.
 */
function extractSegments(trace: SolvedTracePath): TraceSegment[] {
  const segments: TraceSegment[] = []
  const path = trace.tracePath
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]
    const p2 = path[i + 1]
    if (!p1 || !p2) continue
    const dx = Math.abs(p1.x - p2.x)
    const dy = Math.abs(p1.y - p2.y)
    if (dy < 1e-9 && dx > 1e-9) {
      segments.push({
        traceId: trace.mspPairId,
        segIndex: i,
        x1: Math.min(p1.x, p2.x),
        y1: p1.y,
        x2: Math.max(p1.x, p2.x),
        y2: p1.y,
        orientation: "horizontal",
      })
    } else if (dx < 1e-9 && dy > 1e-9) {
      segments.push({
        traceId: trace.mspPairId,
        segIndex: i,
        x1: p1.x,
        y1: Math.min(p1.y, p2.y),
        x2: p1.x,
        y2: Math.max(p1.y, p2.y),
        orientation: "vertical",
      })
    }
  }
  return segments
}

/**
 * Check if two ranges [a1, a2] and [b1, b2] overlap.
 */
function rangesOverlap(
  a1: number,
  a2: number,
  b1: number,
  b2: number,
): boolean {
  const overlapStart = Math.max(a1, b1)
  const overlapEnd = Math.min(a2, b2)
  return overlapEnd - overlapStart > 1e-9
}

/**
 * Merge same-net traces that have parallel segments running close together.
 */
export function mergeSameNetTraces(
  traces: SolvedTracePath[],
  mergedLabelNetIdMap: Record<string, Set<string>>,
): SolvedTracePath[] {
  // Group traces by effective net id
  const netGroups = new Map<string, SolvedTracePath[]>()
  for (const trace of traces) {
    const netId = getEffectiveNetId(trace, mergedLabelNetIdMap)
    if (!netGroups.has(netId)) {
      netGroups.set(netId, [])
    }
    netGroups.get(netId)!.push(trace)
  }

  const traceMap = new Map<string, SolvedTracePath>()
  for (const trace of traces) {
    traceMap.set(trace.mspPairId, trace)
  }

  // For each net group with more than one trace, look for mergeable segments
  for (const [_netId, group] of netGroups) {
    if (group.length < 2) continue

    const allSegments: TraceSegment[] = []
    for (const trace of group) {
      allSegments.push(...extractSegments(trace))
    }

    for (let i = 0; i < allSegments.length; i++) {
      for (let j = i + 1; j < allSegments.length; j++) {
        const segA = allSegments[i]
        const segB = allSegments[j]

        if (segA.traceId === segB.traceId) continue
        if (segA.orientation !== segB.orientation) continue

        if (segA.orientation === "horizontal") {
          const dist = Math.abs(segA.y1 - segB.y1)
          if (dist < MERGE_DISTANCE_THRESHOLD && dist > 1e-9) {
            if (rangesOverlap(segA.x1, segA.x2, segB.x1, segB.x2)) {
              const avgY = (segA.y1 + segB.y1) / 2
              const traceA = traceMap.get(segA.traceId)
              const traceB = traceMap.get(segB.traceId)
              if (traceA && traceA.tracePath[segA.segIndex] && traceA.tracePath[segA.segIndex + 1]) {
                traceA.tracePath[segA.segIndex] = { ...traceA.tracePath[segA.segIndex], y: avgY }
                traceA.tracePath[segA.segIndex + 1] = { ...traceA.tracePath[segA.segIndex + 1], y: avgY }
              }
              if (traceB && traceB.tracePath[segB.segIndex] && traceB.tracePath[segB.segIndex + 1]) {
                traceB.tracePath[segB.segIndex] = { ...traceB.tracePath[segB.segIndex], y: avgY }
                traceB.tracePath[segB.segIndex + 1] = { ...traceB.tracePath[segB.segIndex + 1], y: avgY }
              }
            }
          }
        } else {
          const dist = Math.abs(segA.x1 - segB.x1)
          if (dist < MERGE_DISTANCE_THRESHOLD && dist > 1e-9) {
            if (rangesOverlap(segA.y1, segA.y2, segB.y1, segB.y2)) {
              const avgX = (segA.x1 + segB.x1) / 2
              const traceA = traceMap.get(segA.traceId)
              const traceB = traceMap.get(segB.traceId)
              if (traceA && traceA.tracePath[segA.segIndex] && traceA.tracePath[segA.segIndex + 1]) {
                traceA.tracePath[segA.segIndex] = { ...traceA.tracePath[segA.segIndex], x: avgX }
                traceA.tracePath[segA.segIndex + 1] = { ...traceA.tracePath[segA.segIndex + 1], x: avgX }
              }
              if (traceB && traceB.tracePath[segB.segIndex] && traceB.tracePath[segB.segIndex + 1]) {
                traceB.tracePath[segB.segIndex] = { ...traceB.tracePath[segB.segIndex], x: avgX }
                traceB.tracePath[segB.segIndex + 1] = { ...traceB.tracePath[segB.segIndex + 1], x: avgX }
              }
            }
          }
        }
      }
    }
  }

  // Filter out any undefined points from all trace paths
  for (const trace of traces) {
    trace.tracePath = trace.tracePath.filter(
      (p): p is { x: number; y: number } => p != null && typeof p.x === "number" && typeof p.y === "number",
    )
  }

  return traces
}
