import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const MERGE_THRESHOLD = 0.05 // grid units within which parallel segments are considered "same line"

interface Segment {
  p1: Point
  p2: Point
}

function getSegments(path: Point[]): Segment[] {
  const segs: Segment[] = []
  for (let i = 0; i < path.length - 1; i++) {
    segs.push({ p1: path[i], p2: path[i + 1] })
  }
  return segs
}

function isHorizontal(seg: Segment): boolean {
  return Math.abs(seg.p1.y - seg.p2.y) < 1e-9
}

function isVertical(seg: Segment): boolean {
  return Math.abs(seg.p1.x - seg.p2.x) < 1e-9
}

/**
 * Given two segments on the same net that are parallel and close,
 * return true if they are overlapping (share at least one point range).
 */
function segmentsOverlapOnAxis(
  seg1: Segment,
  seg2: Segment,
  isHoriz: boolean,
): boolean {
  if (isHoriz) {
    const [min1, max1] = [
      Math.min(seg1.p1.x, seg1.p2.x),
      Math.max(seg1.p1.x, seg1.p2.x),
    ]
    const [min2, max2] = [
      Math.min(seg2.p1.x, seg2.p2.x),
      Math.max(seg2.p1.x, seg2.p2.x),
    ]
    return min1 <= max2 && min2 <= max1
  } else {
    const [min1, max1] = [
      Math.min(seg1.p1.y, seg1.p2.y),
      Math.max(seg1.p1.y, seg1.p2.y),
    ]
    const [min2, max2] = [
      Math.min(seg2.p1.y, seg2.p2.y),
      Math.max(seg2.p1.y, seg2.p2.y),
    ]
    return min1 <= max2 && min2 <= max1
  }
}

/**
 * For all traces on the same net, merge any trace segments that are parallel
 * and close together (within MERGE_THRESHOLD) by snapping the second trace's
 * segment to exactly match the first trace's axis value.
 *
 * This cleans up near-duplicate parallel routes on the same net so they
 * visually appear as a single line rather than two very close parallel lines.
 */
export function mergeSameNetParallelTraces(
  traces: SolvedTracePath[],
  globalConnMap: Record<string, string[]> | Map<string, Set<string>>,
): SolvedTracePath[] {
  // Build a map from netId to list of trace indices
  const netToTraceIndices = new Map<string, number[]>()
  for (let i = 0; i < traces.length; i++) {
    const trace = traces[i]
    const netId = trace.userNetId ?? trace.globalConnNetId ?? trace.mspPairId
    if (!netToTraceIndices.has(netId)) {
      netToTraceIndices.set(netId, [])
    }
    netToTraceIndices.get(netId)!.push(i)
  }

  const updatedTraces = traces.map((t) => ({
    ...t,
    tracePath: [...t.tracePath],
  }))

  for (const [_netId, indices] of netToTraceIndices) {
    if (indices.length < 2) continue

    // For each pair of traces on the same net
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const traceA = updatedTraces[indices[a]]
        const traceB = updatedTraces[indices[b]]

        const segsA = getSegments(traceA.tracePath)
        const segsB = getSegments(traceB.tracePath)

        // Check horizontal segments close in Y, or vertical segments close in X
        for (const segA of segsA) {
          for (let si = 0; si < segsB.length; si++) {
            const segB = segsB[si]

            if (isHorizontal(segA) && isHorizontal(segB)) {
              const dy = Math.abs(segA.p1.y - segB.p1.y)
              if (dy > 0 && dy <= MERGE_THRESHOLD) {
                if (segmentsOverlapOnAxis(segA, segB, true)) {
                  // Snap segB's Y to segA's Y by updating the tracePath points
                  const targetY = segA.p1.y
                  const newPath = traceB.tracePath.map((pt) => {
                    if (Math.abs(pt.y - segB.p1.y) < 1e-9) {
                      return { ...pt, y: targetY }
                    }
                    return pt
                  })
                  traceB.tracePath = newPath
                  segsB[si] = {
                    p1: { ...segB.p1, y: targetY },
                    p2: { ...segB.p2, y: targetY },
                  }
                }
              }
            } else if (isVertical(segA) && isVertical(segB)) {
              const dx = Math.abs(segA.p1.x - segB.p1.x)
              if (dx > 0 && dx <= MERGE_THRESHOLD) {
                if (segmentsOverlapOnAxis(segA, segB, false)) {
                  // Snap segB's X to segA's X
                  const targetX = segA.p1.x
                  const newPath = traceB.tracePath.map((pt) => {
                    if (Math.abs(pt.x - segB.p1.x) < 1e-9) {
                      return { ...pt, x: targetX }
                    }
                    return pt
                  })
                  traceB.tracePath = newPath
                  segsB[si] = {
                    p1: { ...segB.p1, x: targetX },
                    p2: { ...segB.p2, x: targetX },
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return updatedTraces
}
