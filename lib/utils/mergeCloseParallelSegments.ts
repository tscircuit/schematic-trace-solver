import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const EPS = 1e-9

export const DEFAULT_MERGE_THRESHOLD = 0.1

/**
 * Merges trace segments of the same net that run parallel and close together
 * onto the same X (for vertical segments) or Y (for horizontal segments).
 *
 * Algorithm:
 * 1. Group traces by globalConnNetId
 * 2. For each pair of traces in the same net, scan all segment pairs
 * 3. If two segments are parallel (both horizontal or both vertical),
 *    overlap on the perpendicular axis, and are within `threshold` of each other,
 *    snap both to the midpoint coordinate
 * 4. After snapping, reconnect adjacent segments to preserve path integrity
 */
export function mergeCloseParallelSegments(
  traces: SolvedTracePath[],
  threshold = DEFAULT_MERGE_THRESHOLD,
): SolvedTracePath[] {
  // Group traces by net
  const byNet = new Map<string, SolvedTracePath[]>()
  for (const trace of traces) {
    const key = trace.globalConnNetId
    if (!byNet.has(key)) byNet.set(key, [])
    byNet.get(key)!.push(trace)
  }

  // We'll mutate copies of the trace paths
  const tracePathsCopy: Map<string, number[][]> = new Map()
  const traceList = traces.map((t, idx) => {
    const pts = t.tracePath.map((p) => [p.x, p.y])
    tracePathsCopy.set(t.mspPairId, pts)
    return { ...t, _idx: idx }
  })

  for (const [netId, netTraces] of byNet) {
    if (netTraces.length < 2) continue

    for (let i = 0; i < netTraces.length; i++) {
      for (let j = i + 1; j < netTraces.length; j++) {
        const traceA = netTraces[i]!
        const traceB = netTraces[j]!
        const ptsA = tracePathsCopy.get(traceA.mspPairId)!
        const ptsB = tracePathsCopy.get(traceB.mspPairId)!

        mergeParallelSegmentsBetweenPaths(ptsA, ptsB, threshold)
      }
    }
  }

  // Rebuild SolvedTracePath with updated coordinates
  return traces.map((t) => {
    const updated = tracePathsCopy.get(t.mspPairId)
    if (!updated) return t
    return {
      ...t,
      tracePath: updated.map(([x, y]) => ({ x: x!, y: y! })),
    }
  })
}

function isHorizontalSeg(
  a: number[],
  b: number[],
): boolean {
  return Math.abs(a[1]! - b[1]!) < EPS
}

function isVerticalSeg(a: number[], b: number[]): boolean {
  return Math.abs(a[0]! - b[0]!) < EPS
}

/**
 * Check if two 1D intervals [aMin,aMax] and [bMin,bMax] overlap
 * (with a small tolerance)
 */
function intervalsOverlap(
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
  tol = EPS,
): boolean {
  return (
    Math.min(aMax, bMax) - Math.max(aMin, bMin) > tol
  )
}

function mergeParallelSegmentsBetweenPaths(
  ptsA: number[][],
  ptsB: number[][],
  threshold: number,
): void {
  for (let si = 0; si < ptsA.length - 1; si++) {
    const a1 = ptsA[si]!
    const a2 = ptsA[si + 1]!

    for (let sj = 0; sj < ptsB.length - 1; sj++) {
      const b1 = ptsB[sj]!
      const b2 = ptsB[sj + 1]!

      // Both horizontal
      if (isHorizontalSeg(a1, a2) && isHorizontalSeg(b1, b2)) {
        const dy = Math.abs(a1[1]! - b1[1]!)
        if (dy < EPS || dy > threshold) continue

        const aMinX = Math.min(a1[0]!, a2[0]!)
        const aMaxX = Math.max(a1[0]!, a2[0]!)
        const bMinX = Math.min(b1[0]!, b2[0]!)
        const bMaxX = Math.max(b1[0]!, b2[0]!)

        if (!intervalsOverlap(aMinX, aMaxX, bMinX, bMaxX)) continue

        // Snap both to midpoint Y
        const midY = (a1[1]! + b1[1]!) / 2
        snapSegmentY(ptsA, si, midY)
        snapSegmentY(ptsB, sj, midY)
      }
      // Both vertical
      else if (isVerticalSeg(a1, a2) && isVerticalSeg(b1, b2)) {
        const dx = Math.abs(a1[0]! - b1[0]!)
        if (dx < EPS || dx > threshold) continue

        const aMinY = Math.min(a1[1]!, a2[1]!)
        const aMaxY = Math.max(a1[1]!, a2[1]!)
        const bMinY = Math.min(b1[1]!, b2[1]!)
        const bMaxY = Math.max(b1[1]!, b2[1]!)

        if (!intervalsOverlap(aMinY, aMaxY, bMinY, bMaxY)) continue

        // Snap both to midpoint X
        const midX = (a1[0]! + b1[0]!) / 2
        snapSegmentX(ptsA, si, midX)
        snapSegmentX(ptsB, sj, midX)
      }
    }
  }
}

/**
 * Move segment at index `si` in `pts` to the given Y value,
 * then fix up adjacent connecting segments to remain orthogonal.
 */
function snapSegmentY(pts: number[][], si: number, newY: number): void {
  pts[si]![1] = newY
  pts[si + 1]![1] = newY

  // Fix the segment before: it is vertical and connects to pts[si]
  if (si > 0) {
    // The previous segment ends at pts[si], which just moved in Y.
    // If previous segment is vertical (same X), just let it stretch.
    // If it's horizontal, we need to re-elbow — but for orthogonal paths
    // the previous segment must be vertical here, so just update the Y.
    const prev = pts[si - 1]!
    const cur = pts[si]!
    // previous segment: prev -> cur
    // if vertical (same x), it naturally stretches
    // if horizontal (same y), this means the path was already on the same y — no change needed
    // No-op: pts[si] already has the new Y, prev stays.
  }

  // Fix the segment after: pts[si+1] to pts[si+2]
  if (si + 2 < pts.length) {
    // Similar logic — vertical segment naturally stretches.
    // No-op needed.
  }
}

/**
 * Move segment at index `si` in `pts` to the given X value,
 * then fix up adjacent connecting segments to remain orthogonal.
 */
function snapSegmentX(pts: number[][], si: number, newX: number): void {
  pts[si]![0] = newX
  pts[si + 1]![0] = newX
  // Adjacent segments naturally stretch/shrink as they are orthogonal.
}