import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const COORD_EPS = 1e-6

/**
 * Rounds a coordinate to a stable bucket key, collapsing values within
 * COORD_EPS of each other to the same key.
 */
function bucketKey(v: number): number {
  return Math.round(v / COORD_EPS)
}

/**
 * Merges trace segments from different SolvedTracePaths that belong to the
 * same net (globalConnNetId) and are collinear (share the same X or Y
 * coordinate) with overlapping or adjacent extents.
 *
 * The algorithm:
 * 1. Groups traces by their globalConnNetId.
 * 2. For each net, collects all individual axis-aligned segments.
 * 3. Buckets horizontal segments by Y and vertical segments by X.
 * 4. Within each bucket, sorts by start coordinate and greedily merges
 *    overlapping/adjacent 1-D intervals.
 * 5. Rebuilds the combined merged segments into a minimal set of
 *    SolvedTracePaths (the first trace in each bucket wins; the rest are
 *    removed once their contribution is absorbed).
 *
 * Because schematic traces are axis-aligned polylines, each segment is either
 * horizontal or vertical.  Two segments of the same orientation that share the
 * same constant coordinate are collinear.  If their projected intervals on the
 * free axis overlap (or touch), they can be merged into one longer segment.
 */
export function mergeCollinearTraces(
  traces: SolvedTracePath[],
): SolvedTracePath[] {
  if (traces.length === 0) return []

  // Work with a deep copy so we don't mutate callers.
  const result = traces.map((t) => ({
    ...t,
    tracePath: t.tracePath.map((p) => ({ ...p })),
  }))

  // Group trace indices by net.
  const byNet = new Map<string, number[]>()
  for (let i = 0; i < result.length; i++) {
    const netId = result[i]!.globalConnNetId
    const list = byNet.get(netId)
    if (list) list.push(i)
    else byNet.set(netId, [i])
  }

  const indicesToRemove = new Set<number>()

  for (const [, idxList] of byNet) {
    if (idxList.length < 2) continue
    _mergeNet(result, idxList, indicesToRemove)
  }

  return result.filter((_, i) => !indicesToRemove.has(i))
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type Segment = {
  traceIdx: number
  segIdx: number
  /** start of interval on the free axis (always ≤ end) */
  start: number
  /** end of interval on the free axis (always ≥ start) */
  end: number
  /** constant coordinate */
  constCoord: number
  isHorizontal: boolean
}

function _mergeNet(
  traces: SolvedTracePath[],
  idxList: number[],
  indicesToRemove: Set<number>,
) {
  // We do multiple passes until no further merge is possible.
  let madeProgress = true
  while (madeProgress) {
    madeProgress = false

    // Build segment list for the current state of all traces in this net.
    const hBuckets = new Map<number, Segment[]>() // key = bucketed Y
    const vBuckets = new Map<number, Segment[]>() // key = bucketed X

    for (const traceIdx of idxList) {
      if (indicesToRemove.has(traceIdx)) continue
      const path = traces[traceIdx]!.tracePath

      for (let si = 0; si < path.length - 1; si++) {
        const p1 = path[si]!
        const p2 = path[si + 1]!
        const horiz = Math.abs(p1.y - p2.y) < COORD_EPS
        const vert = Math.abs(p1.x - p2.x) < COORD_EPS

        if (!horiz && !vert) continue

        const seg: Segment = {
          traceIdx,
          segIdx: si,
          start: horiz
            ? Math.min(p1.x, p2.x)
            : Math.min(p1.y, p2.y),
          end: horiz ? Math.max(p1.x, p2.x) : Math.max(p1.y, p2.y),
          constCoord: horiz ? p1.y : p1.x,
          isHorizontal: horiz,
        }

        if (horiz) {
          const key = bucketKey(p1.y)
          const list = hBuckets.get(key)
          if (list) list.push(seg)
          else hBuckets.set(key, [seg])
        } else {
          const key = bucketKey(p1.x)
          const list = vBuckets.get(key)
          if (list) list.push(seg)
          else vBuckets.set(key, [seg])
        }
      }
    }

    // Try to merge one pair.  On success, restart the outer loop.
    for (const buckets of [hBuckets, vBuckets]) {
      if (madeProgress) break
      for (const [, bucket] of buckets) {
        if (madeProgress) break
        if (bucket.length < 2) continue

        // Sort by start of interval.
        bucket.sort((a, b) => a.start - b.start)

        for (let i = 0; i < bucket.length && !madeProgress; i++) {
          for (let j = i + 1; j < bucket.length && !madeProgress; j++) {
            const sa = bucket[i]!
            const sb = bucket[j]!

            // Only merge cross-trace segments.
            if (sa.traceIdx === sb.traceIdx) continue

            // Check overlap/touch.
            if (sb.start - sa.end > COORD_EPS) break // sorted, so no later j will help

            // Merge intervals.
            const mergedStart = Math.min(sa.start, sb.start)
            const mergedEnd = Math.max(sa.end, sb.end)
            const constCoord = sa.constCoord

            // Update segment A in trace A.
            _updateSegment(traces[sa.traceIdx]!, sa.segIdx, sa.isHorizontal, constCoord, mergedStart, mergedEnd)

            // Remove / trim trace B.
            const pathB = traces[sb.traceIdx]!.tracePath
            if (pathB.length === 2) {
              // Entire trace is this one segment — remove.
              indicesToRemove.add(sb.traceIdx)
            } else {
              // Trim segment B so it no longer overlaps with the merged
              // segment in trace A.  We pull the endpoint that is now inside
              // the merged range to the nearest boundary.
              _trimSegment(traces[sb.traceIdx]!, sb.segIdx, sb.isHorizontal, constCoord, mergedStart, mergedEnd)

              // After trimming, if the segment became zero-length (degenerate),
              // remove the duplicate point.
              const p1 = pathB[sb.segIdx]!
              const p2 = pathB[sb.segIdx + 1]!
              if (
                Math.abs(p1.x - p2.x) < COORD_EPS &&
                Math.abs(p1.y - p2.y) < COORD_EPS
              ) {
                pathB.splice(sb.segIdx + 1, 1)
                if (pathB.length < 2) {
                  indicesToRemove.add(sb.traceIdx)
                }
              }
            }

            madeProgress = true
          }
        }
      }
    }
  }
}

/**
 * Updates both endpoints of a segment (segIdx, segIdx+1) in the trace path
 * so that the segment spans [mergedStart, mergedEnd] on the free axis.
 */
function _updateSegment(
  trace: SolvedTracePath,
  segIdx: number,
  isHorizontal: boolean,
  constCoord: number,
  mergedStart: number,
  mergedEnd: number,
) {
  const path = trace.tracePath
  if (isHorizontal) {
    // Preserve Y, update X extent.  Keep the orientation (left→right or right→left)
    // of the existing segment.
    const origX1 = path[segIdx]!.x
    const origX2 = path[segIdx + 1]!.x
    if (origX1 <= origX2) {
      path[segIdx] = { x: mergedStart, y: constCoord }
      path[segIdx + 1] = { x: mergedEnd, y: constCoord }
    } else {
      path[segIdx] = { x: mergedEnd, y: constCoord }
      path[segIdx + 1] = { x: mergedStart, y: constCoord }
    }
  } else {
    const origY1 = path[segIdx]!.y
    const origY2 = path[segIdx + 1]!.y
    if (origY1 <= origY2) {
      path[segIdx] = { x: constCoord, y: mergedStart }
      path[segIdx + 1] = { x: constCoord, y: mergedEnd }
    } else {
      path[segIdx] = { x: constCoord, y: mergedEnd }
      path[segIdx + 1] = { x: constCoord, y: mergedStart }
    }
  }
}

/**
 * Trims a segment in trace B so that it no longer overlaps the merged range
 * [mergedStart, mergedEnd].  We keep the portion of B that lies *outside* the
 * merged range.
 *
 * Two cases:
 * - B extends beyond mergedEnd on the "far" side: shorten B by moving the
 *   near endpoint to mergedEnd.
 * - B is fully contained within the merged range: collapse the segment to a
 *   degenerate zero-length segment (the caller removes the duplicate point).
 */
function _trimSegment(
  trace: SolvedTracePath,
  segIdx: number,
  isHorizontal: boolean,
  constCoord: number,
  mergedStart: number,
  mergedEnd: number,
) {
  const path = trace.tracePath
  const p1 = path[segIdx]!
  const p2 = path[segIdx + 1]!

  if (isHorizontal) {
    const bStart = Math.min(p1.x, p2.x)
    const bEnd = Math.max(p1.x, p2.x)

    if (bEnd > mergedEnd + COORD_EPS) {
      // B has a tail beyond mergedEnd — keep [mergedEnd..bEnd].
      // Move whichever endpoint is at bStart (inside the merged range) to mergedEnd.
      if (p1.x <= p2.x) {
        // p1 is the left (near) endpoint
        path[segIdx] = { x: mergedEnd, y: constCoord }
      } else {
        // p2 is the left (near) endpoint
        path[segIdx + 1] = { x: mergedEnd, y: constCoord }
      }
    } else {
      // B is fully covered by the merge.  Collapse by making both endpoints
      // equal to p1 (the "connecting" point that stays in the path, the one
      // that links to the previous segment).  The caller will splice out the
      // duplicate p2.
      path[segIdx + 1] = { x: p1.x, y: p1.y }
    }
  } else {
    const bStart = Math.min(p1.y, p2.y)
    const bEnd = Math.max(p1.y, p2.y)

    if (bEnd > mergedEnd + COORD_EPS) {
      if (p1.y <= p2.y) {
        path[segIdx] = { x: constCoord, y: mergedEnd }
      } else {
        path[segIdx + 1] = { x: constCoord, y: mergedEnd }
      }
    } else {
      // Fully covered — collapse.
      path[segIdx + 1] = { x: p1.x, y: p1.y }
    }
  }
}
