import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const SNAP_THRESHOLD = 0.15

interface Segment {
  traceIdx: number
  segIdx: number // index of the start point in tracePath (segment is from segIdx to segIdx+1)
  isHorizontal: boolean
  coord: number // y for horizontal, x for vertical
  rangeMin: number // x-min for horizontal, y-min for vertical
  rangeMax: number // x-max for horizontal, y-max for vertical
}

function getSegments(traces: SolvedTracePath[]): Segment[] {
  const segments: Segment[] = []
  for (let ti = 0; ti < traces.length; ti++) {
    const { tracePath } = traces[ti]
    for (let si = 1; si < tracePath.length - 2; si++) {
      // Only internal segments (skip first and last segments which are pin-anchored)
      const p1 = tracePath[si]
      const p2 = tracePath[si + 1]
      const dx = Math.abs(p2.x - p1.x)
      const dy = Math.abs(p2.y - p1.y)
      if (dy < 1e-9 && dx > 1e-9) {
        // Horizontal segment
        segments.push({
          traceIdx: ti,
          segIdx: si,
          isHorizontal: true,
          coord: p1.y,
          rangeMin: Math.min(p1.x, p2.x),
          rangeMax: Math.max(p1.x, p2.x),
        })
      } else if (dx < 1e-9 && dy > 1e-9) {
        // Vertical segment
        segments.push({
          traceIdx: ti,
          segIdx: si,
          isHorizontal: false,
          coord: p1.x,
          rangeMin: Math.min(p1.y, p2.y),
          rangeMax: Math.max(p1.y, p2.y),
        })
      }
    }
  }
  return segments
}

function rangesOverlap(
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
): boolean {
  return aMax > bMin && bMax > aMin
}

function snapCoord(
  traces: SolvedTracePath[],
  seg: Segment,
  newCoord: number,
): void {
  const trace = traces[seg.traceIdx]
  const path = trace.tracePath
  const si = seg.segIdx
  const oldCoord = seg.coord
  const delta = newCoord - oldCoord

  if (seg.isHorizontal) {
    // Adjust y of both endpoints of this segment
    path[si] = { ...path[si], y: path[si].y + delta }
    path[si + 1] = { ...path[si + 1], y: path[si + 1].y + delta }
  } else {
    // Adjust x of both endpoints of this segment
    path[si] = { ...path[si], x: path[si].x + delta }
    path[si + 1] = { ...path[si + 1], x: path[si + 1].x + delta }
  }
}

/**
 * For traces on the same net, snap close parallel internal segments to the
 * midpoint coordinate so they appear as one line (makes same Y or same X).
 * Only modifies internal segments to preserve pin anchor positions.
 */
export function snapSameNetParallelTraces(
  traces: SolvedTracePath[],
): SolvedTracePath[] {
  // Group trace indices by globalConnNetId
  const netGroups = new Map<string, number[]>()
  for (let i = 0; i < traces.length; i++) {
    const netId = traces[i].globalConnNetId
    if (!netGroups.has(netId)) netGroups.set(netId, [])
    netGroups.get(netId)!.push(i)
  }

  // Work on a mutable copy with cloned paths
  const result: SolvedTracePath[] = traces.map((t) => ({
    ...t,
    tracePath: t.tracePath.map((p) => ({ ...p })),
  }))

  for (const [, traceIndices] of netGroups) {
    if (traceIndices.length < 2) continue

    const netTraces = traceIndices.map((i) => result[i])

    let changed = true
    while (changed) {
      changed = false
      const segs = getSegments(netTraces)

      for (let a = 0; a < segs.length; a++) {
        for (let b = a + 1; b < segs.length; b++) {
          const sa = segs[a]
          const sb = segs[b]

          // Must be same orientation
          if (sa.isHorizontal !== sb.isHorizontal) continue
          // Must be different traces
          if (sa.traceIdx === sb.traceIdx) continue

          const dist = Math.abs(sa.coord - sb.coord)
          if (dist < 1e-9 || dist > SNAP_THRESHOLD) continue
          if (
            !rangesOverlap(sa.rangeMin, sa.rangeMax, sb.rangeMin, sb.rangeMax)
          )
            continue

          // Snap both to midpoint
          const mid = (sa.coord + sb.coord) / 2
          snapCoord(netTraces, sa, mid)
          snapCoord(netTraces, sb, mid)
          changed = true
          break
        }
        if (changed) break
      }
    }
  }

  return result
}
