import type { SchematicTrace } from "../types"

/**
 * Phase: Combine Close Same-Net Trace Segments
 *
 * This phase finds trace segments on the same net that are very close together
 * (nearly overlapping or nearly collinear) and merges them into single segments.
 * This cleans up visual artifacts where routing produces redundant parallel or
 * overlapping segments on the same net.
 *
 * Two segments are candidates for merging if:
 * 1. They belong to the same net
 * 2. They are either overlapping, collinear and contiguous, or nearly parallel
 *    and within a small distance threshold
 */

interface Point {
  x: number
  y: number
}

interface Segment {
  start: Point
  end: Point
  netId?: string
}

const CLOSE_DISTANCE_THRESHOLD = 0.001 // schematic units

/**
 * Check if two numbers are approximately equal within tolerance
 */
function approxEqual(a: number, b: number, tolerance = CLOSE_DISTANCE_THRESHOLD): boolean {
  return Math.abs(a - b) <= tolerance
}

/**
 * Compute the squared distance between two points
 */
function distSq(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2
}

/**
 * Distance between two points
 */
function dist(a: Point, b: Point): number {
  return Math.sqrt(distSq(a, b))
}

/**
 * Returns true if the segment is horizontal (within tolerance)
 */
function isHorizontal(seg: Segment): boolean {
  return approxEqual(seg.start.y, seg.end.y)
}

/**
 * Returns true if the segment is vertical (within tolerance)
 */
function isVertical(seg: Segment): boolean {
  return approxEqual(seg.start.x, seg.end.x)
}

/**
 * Get the minimum coordinate of a horizontal segment
 */
function hMin(seg: Segment): number {
  return Math.min(seg.start.x, seg.end.x)
}

/**
 * Get the maximum coordinate of a horizontal segment
 */
function hMax(seg: Segment): number {
  return Math.max(seg.start.x, seg.end.x)
}

/**
 * Get the minimum coordinate of a vertical segment
 */
function vMin(seg: Segment): number {
  return Math.min(seg.start.y, seg.end.y)
}

/**
 * Get the maximum coordinate of a vertical segment
 */
function vMax(seg: Segment): number {
  return Math.max(seg.start.y, seg.end.y)
}

/**
 * Attempt to merge two horizontal segments that share (approximately) the same Y
 * and whose X ranges overlap or are contiguous.
 * Returns the merged segment or null if they can't be merged.
 */
function tryMergeHorizontal(a: Segment, b: Segment): Segment | null {
  if (!isHorizontal(a) || !isHorizontal(b)) return null
  // Same Y?
  if (!approxEqual(a.start.y, b.start.y)) return null

  const aMin = hMin(a)
  const aMax = hMax(a)
  const bMin = hMin(b)
  const bMax = hMax(b)

  // Check overlap or contiguous (with a small gap tolerance)
  if (bMin > aMax + CLOSE_DISTANCE_THRESHOLD) return null
  if (aMin > bMax + CLOSE_DISTANCE_THRESHOLD) return null

  // Merge: take the full span
  const newMin = Math.min(aMin, bMin)
  const newMax = Math.max(aMax, bMax)
  const y = a.start.y

  return {
    start: { x: newMin, y },
    end: { x: newMax, y },
    netId: a.netId,
  }
}

/**
 * Attempt to merge two vertical segments that share (approximately) the same X
 * and whose Y ranges overlap or are contiguous.
 * Returns the merged segment or null if they can't be merged.
 */
function tryMergeVertical(a: Segment, b: Segment): Segment | null {
  if (!isVertical(a) || !isVertical(b)) return null
  // Same X?
  if (!approxEqual(a.start.x, b.start.x)) return null

  const aMin = vMin(a)
  const aMax = vMax(a)
  const bMin = vMin(b)
  const bMax = vMax(b)

  // Check overlap or contiguous (with a small gap tolerance)
  if (bMin > aMax + CLOSE_DISTANCE_THRESHOLD) return null
  if (aMin > bMax + CLOSE_DISTANCE_THRESHOLD) return null

  // Merge: take the full span
  const newMin = Math.min(aMin, bMin)
  const newMax = Math.max(aMax, bMax)
  const x = a.start.x

  return {
    start: { x, y: newMin },
    end: { x, y: newMax },
    netId: a.netId,
  }
}

/**
 * Given an array of segments for a single net, repeatedly merge any pair of
 * segments that can be merged (collinear and overlapping/contiguous), until no
 * further merges are possible.
 */
function mergeSegmentsForNet(segments: Segment[]): Segment[] {
  let changed = true
  let result = [...segments]

  while (changed) {
    changed = false
    const merged: boolean[] = new Array(result.length).fill(false)
    const next: Segment[] = []

    for (let i = 0; i < result.length; i++) {
      if (merged[i]) continue

      let current = result[i]
      for (let j = i + 1; j < result.length; j++) {
        if (merged[j]) continue

        const candidate =
          tryMergeHorizontal(current, result[j]) ??
          tryMergeVertical(current, result[j])

        if (candidate) {
          current = candidate
          merged[j] = true
          changed = true
        }
      }

      next.push(current)
    }

    result = next
  }

  return result
}

/**
 * Convert a SchematicTrace's edges into Segments grouped by net, merge them,
 * and reconstruct the trace edges.
 *
 * The SchematicTrace type has an `edges` array where each edge has
 * `from` and `to` points. We group edges by net label and then merge
 * collinear overlapping edges.
 */
export function combineCloseSameNetSegments(
  traces: SchematicTrace[]
): SchematicTrace[] {
  return traces.map((trace) => {
    if (!trace.edges || trace.edges.length === 0) return trace

    // Group edges by net (use trace-level net or edge-level net_label)
    // Each edge: { from: Point, to: Point }
    // We'll treat all edges in this trace as the same net and merge them.
    const segments: Segment[] = trace.edges.map((edge) => ({
      start: { x: edge.from.x, y: edge.from.y },
      end: { x: edge.to.x, y: edge.to.y },
    }))

    const merged = mergeSegmentsForNet(segments)

    const newEdges = merged.map((seg) => ({
      ...trace.edges[0], // copy any extra fields from the first edge as defaults
      from: { x: seg.start.x, y: seg.start.y },
      to: { x: seg.end.x, y: seg.end.y },
    }))

    return {
      ...trace,
      edges: newEdges,
    }
  })
}
