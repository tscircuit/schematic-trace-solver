import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

interface Point {
  x: number
  y: number
}

interface TraceSegment {
  segIndex: number
  start: Point
  end: Point
  traceIndex: number
}

function pointsEqual(a: Point, b: Point, tolerance = 1e-6): boolean {
  return (
    Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance
  )
}

function extractSegments(
  trace: SolvedTracePath,
  traceIndex: number,
): TraceSegment[] {
  const segments: TraceSegment[] = []
  const path = trace.tracePath
  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]
    const end = path[i + 1]
    if (!start || !end) continue
    segments.push({
      segIndex: i,
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y },
      traceIndex,
    })
  }
  return segments
}

function getNetIdsForTrace(
  trace: SolvedTracePath,
  mergedLabelNetIdMap: Record<string, Set<string>>,
): Set<string> {
  const netIds = new Set<string>()
  for (const connId of trace.mspConnectionPairIds) {
    netIds.add(connId)
    for (const [labelNetId, mergedSet] of Object.entries(
      mergedLabelNetIdMap,
    )) {
      if (mergedSet.has(connId)) {
        netIds.add(labelNetId)
        for (const id of mergedSet) {
          netIds.add(id)
        }
      }
    }
  }
  return netIds
}

function tracesShareNet(
  traceA: SolvedTracePath,
  traceB: SolvedTracePath,
  mergedLabelNetIdMap: Record<string, Set<string>>,
): boolean {
  const netIdsA = getNetIdsForTrace(traceA, mergedLabelNetIdMap)
  const netIdsB = getNetIdsForTrace(traceB, mergedLabelNetIdMap)
  for (const id of netIdsA) {
    if (netIdsB.has(id)) return true
  }
  return false
}

function findConnectionPoint(
  traceA: SolvedTracePath,
  traceB: SolvedTracePath,
): { pointA: "start" | "end"; pointB: "start" | "end" } | null {
  const pathA = traceA.tracePath
  const pathB = traceB.tracePath
  if (pathA.length === 0 || pathB.length === 0) return null

  const startA = pathA[0]
  const endA = pathA[pathA.length - 1]
  const startB = pathB[0]
  const endB = pathB[pathB.length - 1]

  if (!startA || !endA || !startB || !endB) return null

  if (pointsEqual(endA, startB)) return { pointA: "end", pointB: "start" }
  if (pointsEqual(endA, endB)) return { pointA: "end", pointB: "end" }
  if (pointsEqual(startA, startB)) return { pointA: "start", pointB: "start" }
  if (pointsEqual(startA, endB)) return { pointA: "start", pointB: "end" }

  return null
}

function mergeTracePaths(
  traceA: SolvedTracePath,
  traceB: SolvedTracePath,
  connection: { pointA: "start" | "end"; pointB: "start" | "end" },
): Point[] {
  let pathA = [...traceA.tracePath]
  let pathB = [...traceB.tracePath]

  if (connection.pointA === "start") {
    pathA = pathA.reverse()
  }
  if (connection.pointB === "end") {
    pathB = pathB.reverse()
  }

  // pathA ends where pathB starts, skip duplicate point
  return [...pathA, ...pathB.slice(1)]
}

/**
 * Merges traces that belong to the same net and share connection points.
 */
export function mergeSameNetTraces(
  traces: SolvedTracePath[],
  mergedLabelNetIdMap: Record<string, Set<string>>,
): SolvedTracePath[] {
  if (traces.length <= 1) return traces

  const result: SolvedTracePath[] = [...traces]
  let merged = true

  while (merged) {
    merged = false
    for (let i = 0; i < result.length; i++) {
      const traceA = result[i]
      if (!traceA) continue

      for (let j = i + 1; j < result.length; j++) {
        const traceB = result[j]
        if (!traceB) continue

        if (!tracesShareNet(traceA, traceB, mergedLabelNetIdMap)) continue

        const connection = findConnectionPoint(traceA, traceB)
        if (!connection) continue

        const segmentsA = extractSegments(traceA, i)
        const segmentsB = extractSegments(traceB, j)

        // Validate segments are valid
        let validA = true
        for (const segA of segmentsA) {
          if (segA.segIndex >= 0 && segA.segIndex < traceA.tracePath.length) {
            // segment is valid
          } else {
            validA = false
          }
        }

        let validB = true
        for (const segB of segmentsB) {
          if (segB.segIndex >= 0 && segB.segIndex < traceB.tracePath.length) {
            // segment is valid
          } else {
            validB = false
          }
        }

        if (!validA || !validB) continue

        const mergedPath = mergeTracePaths(traceA, traceB, connection)

        const mergedTrace: SolvedTracePath = {
          ...traceA,
          tracePath: mergedPath,
          mspConnectionPairIds: [
            ...new Set([
              ...traceA.mspConnectionPairIds,
              ...traceB.mspConnectionPairIds,
            ]),
          ],
        }

        result[i] = mergedTrace
        result.splice(j, 1)
        merged = true
        break
      }
      if (merged) break
    }
  }

  return result
}
