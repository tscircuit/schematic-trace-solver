import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Merges collinear trace segments that belong to the same net and are close together.
 * This simplifies the schematic by combining aligned horizontal or vertical trace
 * segments into single continuous lines.
 *
 * @param traces - Array of solved trace paths to process
 * @param threshold - Maximum distance threshold for considering traces "close" (default: 0.01)
 * @returns Array of traces with collinear segments merged
 */
export function mergeCollinearTraces(
  traces: SolvedTracePath[],
  threshold: number = 0.01,
): SolvedTracePath[] {
  // Group traces by their global net ID
  const tracesByNet = new Map<string, SolvedTracePath[]>()

  for (const trace of traces) {
    const netId = trace.globalConnNetId
    if (!tracesByNet.has(netId)) {
      tracesByNet.set(netId, [])
    }
    tracesByNet.get(netId)!.push(trace)
  }

  const mergedTraces: SolvedTracePath[] = []

  // Process each net separately
  for (const [netId, netTraces] of tracesByNet.entries()) {
    // Extract all line segments from traces in this net
    const segments: Array<{
      start: Point
      end: Point
      originalTrace: SolvedTracePath
      isHorizontal: boolean
      isVertical: boolean
      coordinate: number // y for horizontal, x for vertical
    }> = []

    for (const trace of netTraces) {
      const path = trace.tracePath
      for (let i = 0; i < path.length - 1; i++) {
        const start = path[i]!
        const end = path[i + 1]!

        const isHorizontal = Math.abs(start.y - end.y) < threshold
        const isVertical = Math.abs(start.x - end.x) < threshold

        if (isHorizontal || isVertical) {
          segments.push({
            start,
            end,
            originalTrace: trace,
            isHorizontal,
            isVertical,
            coordinate: isHorizontal ? start.y : start.x,
          })
        }
      }
    }

    // Try to merge segments
    const usedTraceIds = new Set<string>()
    const newTraces: SolvedTracePath[] = []

    // Group segments by orientation and coordinate
    const horizontalSegments = segments.filter((s) => s.isHorizontal)
    const verticalSegments = segments.filter((s) => s.isVertical)

    // Merge horizontal segments
    const mergedHorizontal = mergeSegmentGroup(
      horizontalSegments,
      threshold,
      true,
    )
    for (const mergedSeg of mergedHorizontal) {
      if (mergedSeg.mergedTraces.length > 0) {
        for (const trace of mergedSeg.mergedTraces) {
          usedTraceIds.add(trace.mspPairId)
        }

        // Create new merged trace
        const baseTrace = mergedSeg.mergedTraces[0]!
        newTraces.push({
          ...baseTrace,
          tracePath: mergedSeg.path,
          mspConnectionPairIds: mergedSeg.mergedTraces.flatMap(
            (t) => t.mspConnectionPairIds || [t.mspPairId],
          ),
          pinIds: mergedSeg.mergedTraces.flatMap((t) => t.pinIds),
        })
      }
    }

    // Merge vertical segments
    const mergedVertical = mergeSegmentGroup(verticalSegments, threshold, false)
    for (const mergedSeg of mergedVertical) {
      if (mergedSeg.mergedTraces.length > 0) {
        for (const trace of mergedSeg.mergedTraces) {
          usedTraceIds.add(trace.mspPairId)
        }

        // Create new merged trace
        const baseTrace = mergedSeg.mergedTraces[0]!
        newTraces.push({
          ...baseTrace,
          tracePath: mergedSeg.path,
          mspConnectionPairIds: mergedSeg.mergedTraces.flatMap(
            (t) => t.mspConnectionPairIds || [t.mspPairId],
          ),
          pinIds: mergedSeg.mergedTraces.flatMap((t) => t.pinIds),
        })
      }
    }

    // Add traces that weren't merged
    for (const trace of netTraces) {
      if (!usedTraceIds.has(trace.mspPairId)) {
        mergedTraces.push(trace)
      }
    }

    // Add newly merged traces
    mergedTraces.push(...newTraces)
  }

  return mergedTraces
}

interface SegmentInfo {
  start: Point
  end: Point
  originalTrace: SolvedTracePath
  isHorizontal: boolean
  isVertical: boolean
  coordinate: number
}

interface MergedSegment {
  path: Point[]
  mergedTraces: SolvedTracePath[]
}

function mergeSegmentGroup(
  segments: SegmentInfo[],
  threshold: number,
  isHorizontal: boolean,
): MergedSegment[] {
  if (segments.length === 0) return []

  // Group by coordinate (y for horizontal, x for vertical)
  const byCoordinate = new Map<number, SegmentInfo[]>()

  for (const seg of segments) {
    const coord = seg.coordinate
    let found = false

    // Find existing group within threshold
    for (const [existingCoord, group] of byCoordinate.entries()) {
      if (Math.abs(existingCoord - coord) < threshold) {
        group.push(seg)
        found = true
        break
      }
    }

    if (!found) {
      byCoordinate.set(coord, [seg])
    }
  }

  const result: MergedSegment[] = []

  // Process each coordinate group
  for (const [coord, segs] of byCoordinate.entries()) {
    // Check if segments can be merged (overlapping or adjacent)
    const merged = tryMergeSegments(segs, threshold, isHorizontal, coord)
    result.push(...merged)
  }

  return result
}

function tryMergeSegments(
  segments: SegmentInfo[],
  threshold: number,
  isHorizontal: boolean,
  coordinate: number,
): MergedSegment[] {
  if (segments.length === 0) return []
  if (segments.length === 1) {
    // Single segment, but check if it's a simple straight line that can be simplified
    const seg = segments[0]!
    const trace = seg.originalTrace

    // Check if the entire trace is collinear
    if (
      isTraceCollinear(trace.tracePath, isHorizontal, coordinate, threshold)
    ) {
      return [
        {
          path: simplifyCollinearPath(trace.tracePath, isHorizontal),
          mergedTraces: [trace],
        },
      ]
    }

    return []
  }

  // Sort segments by their position along the line
  const sorted = [...segments].sort((a, b) => {
    const aPos = isHorizontal
      ? Math.min(a.start.x, a.end.x)
      : Math.min(a.start.y, a.end.y)
    const bPos = isHorizontal
      ? Math.min(b.start.x, b.end.x)
      : Math.min(b.start.y, b.end.y)
    return aPos - bPos
  })

  const result: MergedSegment[] = []
  let currentGroup: SegmentInfo[] = [sorted[0]!]
  let currentMin = isHorizontal
    ? Math.min(sorted[0]!.start.x, sorted[0]!.end.x)
    : Math.min(sorted[0]!.start.y, sorted[0]!.end.y)
  let currentMax = isHorizontal
    ? Math.max(sorted[0]!.start.x, sorted[0]!.end.x)
    : Math.max(sorted[0]!.start.y, sorted[0]!.end.y)

  for (let i = 1; i < sorted.length; i++) {
    const seg = sorted[i]!
    const segMin = isHorizontal
      ? Math.min(seg.start.x, seg.end.x)
      : Math.min(seg.start.y, seg.end.y)
    const segMax = isHorizontal
      ? Math.max(seg.start.x, seg.end.x)
      : Math.max(seg.start.y, seg.end.y)

    // Check if this segment overlaps or is adjacent to current group
    if (segMin <= currentMax + threshold) {
      currentGroup.push(seg)
      currentMin = Math.min(currentMin, segMin)
      currentMax = Math.max(currentMax, segMax)
    } else {
      // Finalize current group
      if (currentGroup.length > 1) {
        const path = isHorizontal
          ? [
              { x: currentMin, y: coordinate },
              { x: currentMax, y: coordinate },
            ]
          : [
              { x: coordinate, y: currentMin },
              { x: coordinate, y: currentMax },
            ]

        result.push({
          path,
          mergedTraces: currentGroup.map((s) => s.originalTrace),
        })
      }

      // Start new group
      currentGroup = [seg]
      currentMin = segMin
      currentMax = segMax
    }
  }

  // Handle last group
  if (currentGroup.length > 1) {
    const path = isHorizontal
      ? [
          { x: currentMin, y: coordinate },
          { x: currentMax, y: coordinate },
        ]
      : [
          { x: coordinate, y: currentMin },
          { x: coordinate, y: currentMax },
        ]

    result.push({
      path,
      mergedTraces: currentGroup.map((s) => s.originalTrace),
    })
  }

  return result
}

function isTraceCollinear(
  path: Point[],
  isHorizontal: boolean,
  coordinate: number,
  threshold: number,
): boolean {
  if (path.length < 2) return false

  for (const point of path) {
    const pointCoord = isHorizontal ? point.y : point.x
    if (Math.abs(pointCoord - coordinate) > threshold) {
      return false
    }
  }

  return true
}

function simplifyCollinearPath(path: Point[], isHorizontal: boolean): Point[] {
  if (path.length < 2) return path

  if (isHorizontal) {
    const y = path[0]!.y
    const xValues = path.map((p) => p.x)
    const minX = Math.min(...xValues)
    const maxX = Math.max(...xValues)
    return [
      { x: minX, y },
      { x: maxX, y },
    ]
  } else {
    const x = path[0]!.x
    const yValues = path.map((p) => p.y)
    const minY = Math.min(...yValues)
    const maxY = Math.max(...yValues)
    return [
      { x, y: minY },
      { x, y: maxY },
    ]
  }
}
