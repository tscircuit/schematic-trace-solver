import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

interface SimpleTrace {
  trace: SolvedTracePath
  start: Point
  end: Point
  isHorizontal: boolean
  isVertical: boolean
}

/**
 * Checks if a trace is a simple two-point line segment
 */
function isSimpleLineSegment(trace: SolvedTracePath): boolean {
  return trace.tracePath.length === 2
}

/**
 * Extracts simple line segment info from a trace
 */
function getSimpleTraceInfo(trace: SolvedTracePath): SimpleTrace | null {
  if (!isSimpleLineSegment(trace)) return null

  const start = trace.tracePath[0]
  const end = trace.tracePath[1]
  const isHorizontal = Math.abs(start.y - end.y) < 1e-6
  const isVertical = Math.abs(start.x - end.x) < 1e-6

  return {
    trace,
    start,
    end,
    isHorizontal,
    isVertical,
  }
}

/**
 * Checks if two simple traces can be merged
 */
function canMergeSimpleTraces(
  t1: SimpleTrace,
  t2: SimpleTrace,
  threshold: number = 0.05,
): boolean {
  const netId1 = t1.trace.userNetId ?? t1.trace.globalConnNetId
  const netId2 = t2.trace.userNetId ?? t2.trace.globalConnNetId

  // Must be same net
  if (netId1 !== netId2) return false

  // Both must be horizontal or both vertical
  if (t1.isHorizontal && t2.isHorizontal) {
    // Check if they're on the same horizontal line
    if (Math.abs(t1.start.y - t2.start.y) > threshold) return false

    // Check if they overlap or are close in the x direction
    const t1MinX = Math.min(t1.start.x, t1.end.x)
    const t1MaxX = Math.max(t1.start.x, t1.end.x)
    const t2MinX = Math.min(t2.start.x, t2.end.x)
    const t2MaxX = Math.max(t2.start.x, t2.end.x)

    // Check for overlap or closeness
    return (
      (t1MaxX >= t2MinX - threshold && t1MinX <= t2MaxX + threshold) ||
      (t2MaxX >= t1MinX - threshold && t2MinX <= t1MaxX + threshold)
    )
  } else if (t1.isVertical && t2.isVertical) {
    // Check if they're on the same vertical line
    if (Math.abs(t1.start.x - t2.start.x) > threshold) return false

    // Check if they overlap or are close in the y direction
    const t1MinY = Math.min(t1.start.y, t1.end.y)
    const t1MaxY = Math.max(t1.start.y, t1.end.y)
    const t2MinY = Math.min(t2.start.y, t2.end.y)
    const t2MaxY = Math.max(t2.start.y, t2.end.y)

    // Check for overlap or closeness
    return (
      (t1MaxY >= t2MinY - threshold && t1MinY <= t2MaxY + threshold) ||
      (t2MaxY >= t1MinY - threshold && t2MinY <= t1MaxY + threshold)
    )
  }

  return false
}

/**
 * Merges two simple traces into one
 */
function mergeSimpleTraces(t1: SimpleTrace, t2: SimpleTrace): SolvedTracePath {
  if (t1.isHorizontal) {
    const minX = Math.min(t1.start.x, t1.end.x, t2.start.x, t2.end.x)
    const maxX = Math.max(t1.start.x, t1.end.x, t2.start.x, t2.end.x)
    const y = (t1.start.y + t2.start.y) / 2

    return {
      ...t1.trace,
      tracePath: [
        { x: minX, y },
        { x: maxX, y },
      ],
      mspConnectionPairIds: [
        ...t1.trace.mspConnectionPairIds,
        ...t2.trace.mspConnectionPairIds,
      ],
      pinIds: [...t1.trace.pinIds, ...t2.trace.pinIds],
    }
  } else {
    // Vertical
    const minY = Math.min(t1.start.y, t1.end.y, t2.start.y, t2.end.y)
    const maxY = Math.max(t1.start.y, t1.end.y, t2.start.y, t2.end.y)
    const x = (t1.start.x + t2.start.x) / 2

    return {
      ...t1.trace,
      tracePath: [
        { x, y: minY },
        { x, y: maxY },
      ],
      mspConnectionPairIds: [
        ...t1.trace.mspConnectionPairIds,
        ...t2.trace.mspConnectionPairIds,
      ],
      pinIds: [...t1.trace.pinIds, ...t2.trace.pinIds],
    }
  }
}

/**
 * Groups segments by net and orientation, then merges collinear segments that are close together.
 * Only merges simple two-point line segments.
 */
export function mergeCollinearTraces(
  traces: SolvedTracePath[],
  threshold: number = 0.05,
): SolvedTracePath[] {
  if (traces.length === 0) return traces

  // Separate simple traces from complex ones
  const simpleTraces: SimpleTrace[] = []
  const complexTraces: SolvedTracePath[] = []

  for (const trace of traces) {
    const simpleInfo = getSimpleTraceInfo(trace)
    if (simpleInfo) {
      simpleTraces.push(simpleInfo)
    } else {
      complexTraces.push(trace)
    }
  }

  // Merge simple traces
  const merged = new Set<number>()
  const mergedTraces: SolvedTracePath[] = []

  for (let i = 0; i < simpleTraces.length; i++) {
    if (merged.has(i)) continue

    let current = simpleTraces[i]
    merged.add(i)

    // Try to merge with other traces
    let foundMerge = true
    while (foundMerge) {
      foundMerge = false

      for (let j = 0; j < simpleTraces.length; j++) {
        if (merged.has(j)) continue

        if (canMergeSimpleTraces(current, simpleTraces[j], threshold)) {
          current = getSimpleTraceInfo(
            mergeSimpleTraces(current, simpleTraces[j]),
          )!
          merged.add(j)
          foundMerge = true
          break // Start over to find more merges
        }
      }
    }

    mergedTraces.push(current.trace)
  }

  // Return merged traces + complex traces
  return [...mergedTraces, ...complexTraces]
}
