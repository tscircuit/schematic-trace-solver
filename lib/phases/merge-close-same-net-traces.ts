import type { SchematicTrace } from "../types"

/**
 * Threshold distance below which two parallel same-net trace segments that
 * share the same axis are considered "close together" and should be merged
 * into a single segment.
 */
const MERGE_THRESHOLD = 0.01

interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
  /** Index in the original edges array — used for deduplication bookkeeping */
  originalIndex: number
}

type Point = { x: number; y: number }

function approxEqual(a: number, b: number, tol = MERGE_THRESHOLD): boolean {
  return Math.abs(a - b) <= tol
}

/**
 * Returns true when two 1-D intervals [a1,a2] and [b1,b2] overlap or touch
 * (including the case where one is a sub-interval of the other).  The
 * interval bounds may be supplied in either order.
 */
function intervalsOverlapOrTouch(
  a1: number,
  a2: number,
  b1: number,
  b2: number,
): boolean {
  const aMin = Math.min(a1, a2)
  const aMax = Math.max(a1, a2)
  const bMin = Math.min(b1, b2)
  const bMax = Math.max(b1, b2)
  return aMin <= bMax + MERGE_THRESHOLD && bMin <= aMax + MERGE_THRESHOLD
}

/**
 * Merge two overlapping/touching collinear horizontal segments into one.
 */
function mergeHorizontal(a: Segment, b: Segment): Segment {
  const y = (a.y1 + b.y1) / 2 // they are approx equal
  const xMin = Math.min(a.x1, a.x2, b.x1, b.x2)
  const xMax = Math.max(a.x1, a.x2, b.x1, b.x2)
  return { x1: xMin, y1: y, x2: xMax, y2: y, originalIndex: -1 }
}

/**
 * Merge two overlapping/touching collinear vertical segments into one.
 */
function mergeVertical(a: Segment, b: Segment): Segment {
  const x = (a.x1 + b.x1) / 2 // they are approx equal
  const yMin = Math.min(a.y1, a.y2, b.y1, b.y2)
  const yMax = Math.max(a.y1, a.y2, b.y1, b.y2)
  return { x1: x, y1: yMin, x2: x, y2: yMax, originalIndex: -1 }
}

function edgeToSegment(
  edge: SchematicTrace["edges"][number],
  index: number,
): Segment {
  return {
    x1: edge.from.x,
    y1: edge.from.y,
    x2: edge.to.x,
    y2: edge.to.y,
    originalIndex: index,
  }
}

function segmentToEdge(
  seg: Segment,
): SchematicTrace["edges"][number] {
  return {
    from: { x: seg.x1, y: seg.y1 },
    to: { x: seg.x2, y: seg.y2 },
  }
}

/**
 * Repeatedly merge collinear, overlapping/touching same-net segments until
 * no more merges are possible.
 */
function mergeSegments(segments: Segment[]): Segment[] {
  let changed = true
  let current = [...segments]

  while (changed) {
    changed = false
    const merged: boolean[] = new Array(current.length).fill(false)
    const next: Segment[] = []

    for (let i = 0; i < current.length; i++) {
      if (merged[i]) continue
      let seg = current[i]

      for (let j = i + 1; j < current.length; j++) {
        if (merged[j]) continue
        const other = current[j]

        // ── Horizontal merge ──────────────────────────────────────────────
        const aIsH = approxEqual(seg.y1, seg.y2)
        const bIsH = approxEqual(other.y1, other.y2)
        if (
          aIsH &&
          bIsH &&
          approxEqual(seg.y1, other.y1) &&
          intervalsOverlapOrTouch(seg.x1, seg.x2, other.x1, other.x2)
        ) {
          seg = mergeHorizontal(seg, other)
          merged[j] = true
          changed = true
          continue
        }

        // ── Vertical merge ────────────────────────────────────────────────
        const aIsV = approxEqual(seg.x1, seg.x2)
        const bIsV = approxEqual(other.x1, other.x2)
        if (
          aIsV &&
          bIsV &&
          approxEqual(seg.x1, other.x1) &&
          intervalsOverlapOrTouch(seg.y1, seg.y2, other.y1, other.y2)
        ) {
          seg = mergeVertical(seg, other)
          merged[j] = true
          changed = true
          continue
        }
      }

      next.push(seg)
    }

    current = next
  }

  return current
}

/**
 * Phase: merge-close-same-net-traces
 *
 * Iterates over all traces in the solved schematic and, for each net, merges
 * collinear trace segments that overlap or are within MERGE_THRESHOLD of each
 * other into a single segment.  This cleans up visual artefacts where the
 * router has emitted two parallel (or co-linear) wires for the same net in
 * nearly the same position.
 */
export function mergeCloseSameNetTraces(
  traces: SchematicTrace[],
): SchematicTrace[] {
  // Group traces by net name so we only merge within the same net.
  const byNet = new Map<string, SchematicTrace[]>()
  const noNet: SchematicTrace[] = []

  for (const trace of traces) {
    const net = (trace as any).net_name ?? (trace as any).net ?? null
    if (net) {
      const list = byNet.get(net) ?? []
      list.push(trace)
      byNet.set(net, list)
    } else {
      noNet.push(trace)
    }
  }

  const result: SchematicTrace[] = []

  for (const [, netTraces] of byNet) {
    // Collect every edge from every trace in this net into one flat list.
    const allSegments: Segment[] = []
    for (const trace of netTraces) {
      trace.edges.forEach((edge, idx) => {
        allSegments.push(edgeToSegment(edge, idx))
      })
    }

    const mergedSegments = mergeSegments(allSegments)

    // Rebuild: put all merged edges back onto the first trace of this net.
    // The remaining traces in the net (if any) will have empty edge lists and
    // will be filtered out below.
    const primary = { ...netTraces[0], edges: mergedSegments.map(segmentToEdge) }
    result.push(primary)
    // Any extra traces for this net are now empty — drop them.
  }

  // Traces with no net are kept as-is.
  result.push(...noNet)

  return result
}
