import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const SNAP_TOLERANCE = 0.2 // segments within this distance are considered "close"

function getNetIdsForTrace(
  trace: SolvedTracePath,
  mergedLabelNetIdMap: Record<string, Set<string>>,
): Set<string> {
  const netIds = new Set<string>()
  const primaryId = trace.globalConnNetId ?? trace.mspPairId
  netIds.add(primaryId)
  for (const connId of trace.mspConnectionPairIds ?? []) {
    netIds.add(connId)
  }
  for (const [labelNetId, mergedSet] of Object.entries(mergedLabelNetIdMap)) {
    let matches = false
    for (const id of netIds) {
      if (mergedSet.has(id)) {
        matches = true
        break
      }
    }
    if (matches) {
      netIds.add(labelNetId)
      for (const id of mergedSet) {
        netIds.add(id)
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

interface Segment {
  traceIndex: number
  segIndex: number
  isHorizontal: boolean
  isVertical: boolean
  /** For horizontal segments: the y value */
  y?: number
  /** For vertical segments: the x value */
  x?: number
  minCoord: number
  maxCoord: number
}

function extractSegments(
  trace: SolvedTracePath,
  traceIndex: number,
): Segment[] {
  const segments: Segment[] = []
  const path = trace.tracePath
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]
    const p2 = path[i + 1]
    if (!p1 || !p2) continue
    const dx = Math.abs(p2.x - p1.x)
    const dy = Math.abs(p2.y - p1.y)
    if (dy < 1e-9 && dx > 1e-9) {
      // horizontal segment
      segments.push({
        traceIndex,
        segIndex: i,
        isHorizontal: true,
        isVertical: false,
        y: p1.y,
        minCoord: Math.min(p1.x, p2.x),
        maxCoord: Math.max(p1.x, p2.x),
      })
    } else if (dx < 1e-9 && dy > 1e-9) {
      // vertical segment
      segments.push({
        traceIndex,
        segIndex: i,
        isHorizontal: false,
        isVertical: true,
        x: p1.x,
        minCoord: Math.min(p1.y, p2.y),
        maxCoord: Math.max(p1.y, p2.y),
      })
    }
  }
  return segments
}

function segmentsOverlap(a: Segment, b: Segment): boolean {
  return a.maxCoord > b.minCoord && b.maxCoord > a.minCoord
}

/**
 * Snaps close parallel segments belonging to the same net to the same coordinate.
 * Horizontal segments close in Y get snapped to average Y.
 * Vertical segments close in X get snapped to average X.
 */
export function mergeSameNetTraces(
  traces: SolvedTracePath[],
  mergedLabelNetIdMap: Record<string, Set<string>>,
): SolvedTracePath[] {
  if (traces.length <= 1) return traces

  // Work on mutable copies of paths
  const paths = traces.map((t) => t.tracePath.map((p) => ({ ...p })))

  // Collect all segments with their trace/seg index
  const allSegments: Segment[] = []
  for (let ti = 0; ti < traces.length; ti++) {
    const trace = traces[ti]
    if (!trace) continue
    allSegments.push(
      ...extractSegments({ ...trace, tracePath: paths[ti]! }, ti),
    )
  }

  // Find pairs of close parallel overlapping segments from same-net traces
  for (let i = 0; i < allSegments.length; i++) {
    const segA = allSegments[i]!
    for (let j = i + 1; j < allSegments.length; j++) {
      const segB = allSegments[j]!
      if (segA.traceIndex === segB.traceIndex) continue
      if (
        !tracesShareNet(
          traces[segA.traceIndex]!,
          traces[segB.traceIndex]!,
          mergedLabelNetIdMap,
        )
      )
        continue

      if (segA.isHorizontal && segB.isHorizontal) {
        const yDiff = Math.abs(segA.y! - segB.y!)
        if (
          yDiff < SNAP_TOLERANCE &&
          yDiff > 1e-9 &&
          segmentsOverlap(segA, segB)
        ) {
          const avgY = (segA.y! + segB.y!) / 2
          // Snap all points in traceA with y == segA.y to avgY
          const pathA = paths[segA.traceIndex]!
          for (const p of pathA) {
            if (Math.abs(p.y - segA.y!) < 1e-9) p.y = avgY
          }
          // Snap all points in traceB with y == segB.y to avgY
          const pathB = paths[segB.traceIndex]!
          for (const p of pathB) {
            if (Math.abs(p.y - segB.y!) < 1e-9) p.y = avgY
          }
          // Update segment y values for future comparisons
          segA.y = avgY
          segB.y = avgY
        }
      } else if (segA.isVertical && segB.isVertical) {
        const xDiff = Math.abs(segA.x! - segB.x!)
        if (
          xDiff < SNAP_TOLERANCE &&
          xDiff > 1e-9 &&
          segmentsOverlap(segA, segB)
        ) {
          const avgX = (segA.x! + segB.x!) / 2
          const pathA = paths[segA.traceIndex]!
          for (const p of pathA) {
            if (Math.abs(p.x - segA.x!) < 1e-9) p.x = avgX
          }
          const pathB = paths[segB.traceIndex]!
          for (const p of pathB) {
            if (Math.abs(p.x - segB.x!) < 1e-9) p.x = avgX
          }
          segA.x = avgX
          segB.x = avgX
        }
      }
    }
  }

  return traces.map((t, i) => ({ ...t, tracePath: paths[i]! }))
}
