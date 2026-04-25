import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/** Snap threshold: maximum perpendicular distance to consider two
 *  same-net segments as "close enough" to align. */
const SNAP_THRESHOLD = 0.15

/**
 * Aligns parallel trace segments belonging to the same net when they are
 * within SNAP_THRESHOLD of each other AND overlap sufficiently along their
 * shared axis. Snaps both to their average perpendicular coordinate.
 *
 * Returns a deep-cloned array — the original traces are never mutated.
 */
export const alignSameNetTraces = (
  traces: SolvedTracePath[],
  _options: { snapThreshold?: number } = {},
): SolvedTracePath[] => {
  const threshold = _options.snapThreshold ?? SNAP_THRESHOLD

  // --- 1. Extract axis-aligned segments with their trace/point indices ---
  type Segment = {
    traceIdx: number
    p0idx: number
    p1idx: number
    x0: number
    y0: number
    x1: number
    y1: number
    orientation: "H" | "V"
  }

  const segments: Segment[] = []

  for (let ti = 0; ti < traces.length; ti++) {
    const path = traces[ti]!.tracePath
    for (let pi = 0; pi < path.length - 1; pi++) {
      const a = path[pi]!
      const b = path[pi + 1]!
      const dx = Math.abs(a.x - b.x)
      const dy = Math.abs(a.y - b.y)
      if (dx < 1e-9) {
        segments.push({
          traceIdx: ti,
          p0idx: pi,
          p1idx: pi + 1,
          x0: a.x,
          y0: a.y,
          x1: b.x,
          y1: b.y,
          orientation: "V",
        })
      } else if (dy < 1e-9) {
        segments.push({
          traceIdx: ti,
          p0idx: pi,
          p1idx: pi + 1,
          x0: a.x,
          y0: a.y,
          x1: b.x,
          y1: b.y,
          orientation: "H",
        })
      }
    }
  }

  // --- 2. Group segments by net ---
  const netMap = new Map<string, number[]>()
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si]!
    const netId =
      traces[seg.traceIdx]!.globalConnNetId ??
      traces[seg.traceIdx]!.dcConnNetId ??
      ""
    if (!netId) continue
    let arr = netMap.get(netId)
    if (!arr) {
      arr = []
      netMap.set(netId, arr)
    }
    arr.push(si)
  }

  // --- 3. For each net, find pairs to snap ---
  type Snap = {
    traceIdx: number
    pointIdx: number
    axis: "x" | "y"
    newValue: number
  }
  const snaps: Snap[] = []
  const snapped = new Set<string>()

  function rangeOverlap(
    aLo: number,
    aHi: number,
    bLo: number,
    bHi: number,
  ): number {
    return Math.max(0, Math.min(aHi, bHi) - Math.max(aLo, bLo))
  }

  for (const [, segIndices] of netMap) {
    for (let i = 0; i < segIndices.length; i++) {
      const a = segments[segIndices[i]!]!
      for (let j = i + 1; j < segIndices.length; j++) {
        const b = segments[segIndices[j]!]!
        if (a.orientation !== b.orientation) continue
        // Skip segments from the same trace
        if (a.traceIdx === b.traceIdx) continue

        const perpAxis: "x" | "y" = a.orientation === "H" ? "y" : "x"
        const aPerp = perpAxis === "x" ? a.x0 : a.y0
        const bPerp = perpAxis === "x" ? b.x0 : b.y0

        if (Math.abs(aPerp - bPerp) > threshold) continue

        // Check overlap along the shared (parallel) axis
        const aLo = Math.min(
          a.orientation === "H" ? a.x0 : a.y0,
          a.orientation === "H" ? a.x1 : a.y1,
        )
        const aHi = Math.max(
          a.orientation === "H" ? a.x0 : a.y0,
          a.orientation === "H" ? a.x1 : a.y1,
        )
        const bLo = Math.min(
          b.orientation === "H" ? b.x0 : b.y0,
          b.orientation === "H" ? b.x1 : b.y1,
        )
        const bHi = Math.max(
          b.orientation === "H" ? b.x0 : b.y0,
          b.orientation === "H" ? b.x1 : b.y1,
        )
        const overlap = rangeOverlap(aLo, aHi, bLo, bHi)
        const minLen = Math.min(aHi - aLo, bHi - bLo)
        if (minLen < 1e-9 || overlap / minLen < 0.25) continue

        // Snap both to average perpendicular coordinate
        const avgPerp = (aPerp + bPerp) / 2

        for (const seg of [a, b]) {
          for (const pidx of [seg.p0idx, seg.p1idx]) {
            const snapKey = `${seg.traceIdx}:${pidx}:${perpAxis}`
            if (!snapped.has(snapKey)) {
              snapped.add(snapKey)
              snaps.push({
                traceIdx: seg.traceIdx,
                pointIdx: pidx,
                axis: perpAxis,
                newValue: avgPerp,
              })
            }
          }
        }
      }
    }
  }

  // --- 4. Apply snaps to a deep clone ---
  const result: SolvedTracePath[] = traces.map((t) => ({
    ...t,
    tracePath: t.tracePath.map((p) => ({ ...p })),
  }))
  for (const snap of snaps) {
    const pt = result[snap.traceIdx]!.tracePath[snap.pointIdx]!
    if (snap.axis === "x") pt.x = snap.newValue
    else pt.y = snap.newValue
  }

  return result
}
