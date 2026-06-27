import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

/**
 * The maximum distance (in schematic coordinates) between two parallel, overlapping
 * same-net trace segments before they are merged/snapped onto a common coordinate.
 */
const DEFAULT_MERGE_DISTANCE = 0.18

const EPS = 1e-6

type Orientation = "horizontal" | "vertical"

/**
 * Descriptor for a single orthogonal segment of a solved trace path.
 */
type SegmentRef = {
  /** Index into the traces array */
  traceIndex: number
  /** Index of the first point of the segment within the trace path */
  startIndex: number
  orientation: Orientation
  /** The fixed coordinate (Y for horizontal, X for vertical) */
  fixedCoord: number
  /** The range along the free axis [min, max] */
  min: number
  max: number
}

/**
 * Build a SegmentRef for the segment starting at `startIndex` in `trace`.
 * Returns null for degenerate or diagonal segments.
 */
const getSegmentRef = (
  trace: SolvedTracePath,
  traceIndex: number,
  startIndex: number,
): SegmentRef | null => {
  const p1 = trace.tracePath[startIndex]
  const p2 = trace.tracePath[startIndex + 1]

  if (!p1 || !p2) return null

  const dx = Math.abs(p1.x - p2.x)
  const dy = Math.abs(p1.y - p2.y)

  if (dy < EPS && dx > EPS) {
    // Horizontal segment
    return {
      traceIndex,
      startIndex,
      orientation: "horizontal",
      fixedCoord: p1.y,
      min: Math.min(p1.x, p2.x),
      max: Math.max(p1.x, p2.x),
    }
  }

  if (dx < EPS && dy > EPS) {
    // Vertical segment
    return {
      traceIndex,
      startIndex,
      orientation: "vertical",
      fixedCoord: p1.x,
      min: Math.min(p1.y, p2.y),
      max: Math.max(p1.y, p2.y),
    }
  }

  return null
}

/** Return a stable net identifier for a trace. */
const getNetId = (trace: SolvedTracePath): string =>
  (trace as any).userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId

/** True when the two segment ranges overlap (share at least a point). */
const rangesOverlap = (a: SegmentRef, b: SegmentRef): boolean =>
  Math.min(a.max, b.max) - Math.max(a.min, b.min) > EPS

/**
 * A segment is "interior" when neither its start point nor its end point is
 * a terminal endpoint of the trace (i.e. we will not move pin-attachment points).
 */
const isInteriorSegment = (
  trace: SolvedTracePath,
  segmentStartIndex: number,
): boolean =>
  segmentStartIndex > 0 && segmentStartIndex + 1 < trace.tracePath.length - 1

/**
 * Return an updated trace where segment `segmentStartIndex` has been snapped
 * to `fixedCoord` along the given orientation, then the path simplified.
 */
const moveSegmentToFixedCoord = (
  trace: SolvedTracePath,
  segmentStartIndex: number,
  orientation: Orientation,
  fixedCoord: number,
): SolvedTracePath => {
  const path: Point[] = trace.tracePath.map((p) => ({ ...p }))

  const p1 = path[segmentStartIndex]!
  const p2 = path[segmentStartIndex + 1]!

  if (orientation === "horizontal") {
    path[segmentStartIndex] = { ...p1, y: fixedCoord }
    path[segmentStartIndex + 1] = { ...p2, y: fixedCoord }
  } else {
    path[segmentStartIndex] = { ...p1, x: fixedCoord }
    path[segmentStartIndex + 1] = { ...p2, x: fixedCoord }
  }

  return { ...trace, tracePath: simplifyPath(path) }
}

/**
 * Merge nearby same-net trace segments.
 *
 * For every pair (or larger group) of interior trace segments that:
 *   - belong to the same net
 *   - have the same orientation (both horizontal or both vertical)
 *   - overlap along the free axis
 *   - are within `mergeDistance` of each other along the fixed axis
 *
 * …the segments are snapped to their average fixed-axis coordinate so that
 * visually they appear as a single, clean line rather than closely-spaced
 * parallel lines.
 *
 * Endpoint segments (the first and last segment of each trace) are never
 * moved, preserving pin-connection geometry.
 */
export const mergeNearbySameNetSegments = (
  traces: SolvedTracePath[],
  mergeDistance = DEFAULT_MERGE_DISTANCE,
): SolvedTracePath[] => {
  // Deep-clone paths so we don't mutate the originals
  let output: SolvedTracePath[] = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((p) => ({ ...p })),
  }))

  // Collect all interior segments with their metadata
  const segments: SegmentRef[] = []
  for (let traceIndex = 0; traceIndex < output.length; traceIndex++) {
    const trace = output[traceIndex]!
    for (let segIdx = 0; segIdx < trace.tracePath.length - 1; segIdx++) {
      if (!isInteriorSegment(trace, segIdx)) continue
      const seg = getSegmentRef(trace, traceIndex, segIdx)
      if (seg) segments.push(seg)
    }
  }

  // Union-Find / BFS clustering: group segments that should be merged together
  const visited = new Set<number>()

  for (let startIdx = 0; startIdx < segments.length; startIdx++) {
    if (visited.has(startIdx)) continue

    const componentIndexes: number[] = []
    const queue: number[] = [startIdx]
    visited.add(startIdx)

    while (queue.length > 0) {
      const currentIdx = queue.shift()!
      const current = segments[currentIdx]!
      componentIndexes.push(currentIdx)

      for (
        let candidateIdx = 0;
        candidateIdx < segments.length;
        candidateIdx++
      ) {
        if (visited.has(candidateIdx)) continue

        const candidate = segments[candidateIdx]!

        // Must be the same net
        if (
          getNetId(output[current.traceIndex]!) !==
          getNetId(output[candidate.traceIndex]!)
        )
          continue

        // Must have the same orientation
        if (current.orientation !== candidate.orientation) continue

        // Must overlap along the free axis
        if (!rangesOverlap(current, candidate)) continue

        // Must be close enough along the fixed axis
        const distance = Math.abs(current.fixedCoord - candidate.fixedCoord)
        if (distance <= EPS || distance > mergeDistance) continue

        visited.add(candidateIdx)
        queue.push(candidateIdx)
      }
    }

    // Only act when at least two segments form a merge group
    if (componentIndexes.length < 2) continue

    const component = componentIndexes.map((idx) => segments[idx]!)

    // Snap all group members to the average fixed coordinate
    const mergedCoord =
      component.reduce((sum, seg) => sum + seg.fixedCoord, 0) / component.length

    for (const seg of component) {
      output[seg.traceIndex] = moveSegmentToFixedCoord(
        output[seg.traceIndex]!,
        seg.startIndex,
        seg.orientation,
        mergedCoord,
      )
    }
  }

  return output
}
