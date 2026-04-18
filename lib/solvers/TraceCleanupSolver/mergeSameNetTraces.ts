import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Represents a single segment extracted from a trace path, with indices back to the original path.
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
 * Check if two ranges [a1, a2] and [b1, b2] overlap (with some minimum overlap).
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
 * For each group of traces sharing the same net, find parallel segments within
 * the merge threshold distance and snap them to a shared coordinate (average).
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

  // Track which trace paths have been modified so we can simplify them
  const modifiedTraceIds = new Set<string>()

  // Build a lookup from traceId to trace object
  const traceById = new Map<string, SolvedTracePath>()
  for (const trace of traces) {
    traceById.set(trace.mspPairId, trace)
  }

  // For each net group with more than one trace, look for mergeable segments
  for (const [_netId, group] of netGroups) {
    if (group.length < 2) continue

    // Extract all segments from all traces in this group
    const allSegments: TraceSegment[] = []
    for (const trace of group) {
      allSegments.push(...extractSegments(trace))
    }

    // Find pairs of segments from different traces that are parallel and close
    for (let i = 0; i < allSegments.length; i++) {
      for (let j = i + 1; j < allSegments.length; j++) {
        const segA = allSegments[i]
        const segB = allSegments[j]

        // Must be from different traces
        if (segA.traceId === segB.traceId) continue

        // Must have same orientation
        if (segA.orientation !== segB.orientation) continue

        if (segA.orientation === "horizontal") {
          // Both horizontal: check if y values are close and x ranges overlap
          const dist = Math.abs(segA.y1 - segB.y1)
          if (dist > MERGE_DISTANCE_THRESHOLD) continue
          if (!rangesOverlap(segA.x1, segA.x2, segB.x1, segB.x2)) continue

          // Snap both to the average y
          const avgY = (segA.y1 + segB.y1) / 2

          const traceA = traceById.get(segA.traceId)
          const traceB = traceById.get(segB.traceId)
          if (!traceA || !traceB) continue

          // Bounds check before modifying traceA
          if (
            segA.segIndex >= 0 &&
            segA.segIndex < traceA.tracePath.length
          ) {
            traceA.tracePath[segA.segIndex] = {
              x: traceA.tracePath[segA.segIndex].x,
              y: avgY,
            }
          }
          if (
            segA.segIndex + 1 >= 0 &&
            segA.segIndex + 1 < traceA.tracePath.length
          ) {
            traceA.tracePath[segA.segIndex + 1] = {
              x: traceA.tracePath[segA.segIndex + 1].x,
              y: avgY,
            }
          }

          // Bounds check before modifying traceB
          if (
            segB.segIndex >= 0 &&
            segB.segIndex < traceB.tracePath.length
          ) {
            traceB.tracePath[segB.segIndex] = {
              x: traceB.tracePath[segB.segIndex].x,
              y: avgY,
            }
          }
          if (
            segB.segIndex + 1 >= 0 &&
            segB.segIndex + 1 < traceB.tracePath.length
          ) {
            traceB.tracePath[segB.segIndex + 1] = {
              x: traceB.tracePath[segB.segIndex + 1].x,
              y: avgY,
            }
          }

          modifiedTraceIds.add(segA.traceId)
          modifiedTraceIds.add(segB.traceId)
        } else {
          // Both vertical: check if x values are close and y ranges overlap
          const dist = Math.abs(segA.x1 - segB.x1)
          if (dist > MERGE_DISTANCE_THRESHOLD) continue
          if (!rangesOverlap(segA.y1, segA.y2, segB.y1, segB.y2)) continue

          // Snap both to the average x
          const avgX = (segA.x1 + segB.x1) / 2

          const traceA = traceById.get(segA.traceId)
          const traceB = traceById.get(segB.traceId)
          if (!traceA || !traceB) continue

          // Bounds check before modifying traceA
          if (
            segA.segIndex >= 0 &&
            segA.segIndex < traceA.tracePath.length
          ) {
            traceA.tracePath[segA.segIndex] = {
              x: avgX,
              y: traceA.tracePath[segA.segIndex].y,
            }
          }
          if (
            segA.segIndex + 1 >= 0 &&
            segA.segIndex + 1 < traceA.tracePath.length
          ) {
            traceA.tracePath[segA.segIndex + 1] = {
              x: avgX,
              y: traceA.tracePath[segA.segIndex + 1].y,
            }
          }

          // Bounds check before modifying traceB
          if (
            segB.segIndex >= 0 &&
            segB.segIndex < traceB.tracePath.length
          ) {
            traceB.tracePath[segB.segIndex] = {
              x: avgX,
              y: traceB.tracePath[segB.segIndex].y,
            }
          }
          if (
            segB.segIndex + 1 >= 0 &&
            segB.segIndex + 1 < traceB.tracePath.length
          ) {
            traceB.tracePath[segB.segIndex + 1] = {
              x: avgX,
              y: traceB.tracePath[segB.segIndex + 1].y,
            }
          }

          modifiedTraceIds.add(segA.traceId)
          modifiedTraceIds.add(segB.traceId)
        }
      }
    }
  }

  // Filter out any null/undefined entries that may have been introduced
  return traces.map((trace) => {
    const filteredPath = trace.tracePath.filter(
      (p): p is { x: number; y: number } =>
        p != null &&
        typeof p.x === "number" &&
        typeof p.y === "number" &&
        !Number.isNaN(p.x) &&
        !Number.isNaN(p.y),
    )
    return { ...trace, tracePath: filteredPath }
  })
}
