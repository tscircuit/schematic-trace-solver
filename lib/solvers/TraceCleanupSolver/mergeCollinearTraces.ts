import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const EPS = 1e-6

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
 * Simplifies a single trace by removing intermediate points that are
 * collinear with their neighbors. For example, (0,0)→(1,0)→(2,0)→(3,0)
 * becomes (0,0)→(3,0).
 */
function simplifyTraceCollinearPoints(trace: SolvedTracePath): SolvedTracePath {
  const path = trace.tracePath
  if (path.length <= 2) return trace

  const newPath: Point[] = [path[0]!]

  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1]!
    const curr = path[i]!
    const next = path[i + 1]!

    // Check if prev→curr and curr→next are in the same direction
    const prevHorizontal = Math.abs(prev.y - curr.y) < EPS
    const currHorizontal = Math.abs(curr.y - next.y) < EPS
    const prevVertical = Math.abs(prev.x - curr.x) < EPS
    const currVertical = Math.abs(curr.x - next.x) < EPS

    if ((prevHorizontal && currHorizontal) || (prevVertical && currVertical)) {
      // Same orientation — skip the intermediate point
      continue
    }

    newPath.push(curr)
  }

  newPath.push(path[path.length - 1]!)

  return { ...trace, tracePath: newPath }
}

/**
 * Extracts simple line segment info from a trace
 */
function getSimpleTraceInfo(trace: SolvedTracePath): SimpleTrace | null {
  if (!isSimpleLineSegment(trace)) return null

  const start = trace.tracePath[0]
  const end = trace.tracePath[1]
  const isHorizontal = Math.abs(start.y - end.y) < EPS
  const isVertical = Math.abs(start.x - end.x) < EPS

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
  threshold = 0.05,
): boolean {
  // Must share the same global connectivity net (primary check)
  if (t1.trace.globalConnNetId !== t2.trace.globalConnNetId) return false

  // If both traces carry an explicit userNetId, they must agree
  if (
    t1.trace.userNetId != null &&
    t2.trace.userNetId != null &&
    t1.trace.userNetId !== t2.trace.userNetId
  ) {
    return false
  }

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
  }
  if (t1.isVertical && t2.isVertical) {
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
      mspConnectionPairIds: Array.from(
        new Set([
          ...t1.trace.mspConnectionPairIds,
          ...t2.trace.mspConnectionPairIds,
        ]),
      ),
      pinIds: Array.from(new Set([...t1.trace.pinIds, ...t2.trace.pinIds])),
    }
  }
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
    mspConnectionPairIds: Array.from(
      new Set([
        ...t1.trace.mspConnectionPairIds,
        ...t2.trace.mspConnectionPairIds,
      ]),
    ),
    pinIds: Array.from(new Set([...t1.trace.pinIds, ...t2.trace.pinIds])),
  }
}

/**
 * Groups segments by net and orientation, then merges collinear segments that are close together.
 * Only merges simple two-point line segments.
 */
export function mergeCollinearTraces(
  traces: SolvedTracePath[],
  threshold = 0.05,
): SolvedTracePath[] {
  if (traces.length === 0) return traces

  // First pass: simplify individual traces by removing collinear intermediate points
  const simplifiedTraces = traces.map(simplifyTraceCollinearPoints)

  // Separate simple traces from complex ones
  const simpleTraces: SimpleTrace[] = []
  const complexTraces: SolvedTracePath[] = []

  for (const trace of simplifiedTraces) {
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
          const mergedResult = mergeSimpleTraces(current, simpleTraces[j])

          // Preserve graph connectivity: update the absorbed trace in-place
          // so downstream solvers (e.g. NetLabelPlacementSolver) that hold
          // references to individual trace objects see the unified path.
          simpleTraces[j].trace.tracePath = [...mergedResult.tracePath]
          simpleTraces[j].trace.mspConnectionPairIds = [
            ...mergedResult.mspConnectionPairIds,
          ]
          simpleTraces[j].trace.pinIds = [...mergedResult.pinIds]

          current = getSimpleTraceInfo(mergedResult)!
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
