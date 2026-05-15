import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"

export interface SameNetTraceCombiningSolverInput {
  traces: SolvedTracePath[]
  /** Maximum distance between parallel trace segments to consider them for combining */
  proximityThreshold?: number
}

export interface SameNetTraceCombiningSolverOutput {
  traces: SolvedTracePath[]
  combinedCount: number
}

/**
 * Calculates perpendicular distance from a point to a line segment.
 */
function pointToLineDistance(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
): number {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const lengthSq = dx * dx + dy * dy

  if (lengthSq === 0) {
    // Line segment is a point
    return Math.sqrt(
      (point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2,
    )
  }

  // Project point onto the line
  let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))

  const projX = lineStart.x + t * dx
  const projY = lineStart.y + t * dy

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2)
}

/**
 * Checks if two line segments are roughly parallel (within a tolerance).
 */
function areParallel(
  seg1Start: Point,
  seg1End: Point,
  seg2Start: Point,
  seg2End: Point,
  angleTolerance: number = 0.1,
): boolean {
  // Calculate angle of each segment
  const angle1 = Math.atan2(seg1End.y - seg1Start.y, seg1End.x - seg1Start.x)
  const angle2 = Math.atan2(seg2End.y - seg2Start.y, seg2End.x - seg2Start.x)

  // Normalize angle difference to [-PI, PI]
  let angleDiff = Math.abs(angle1 - angle2)
  if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff

  // Check if segments are parallel (horizontal, vertical, or same angle)
  const isHorizontal =
    Math.abs(Math.abs(angle1) - Math.PI / 2) < angleTolerance &&
    Math.abs(Math.abs(angle2) - Math.PI / 2) < angleTolerance
  const isVertical =
    Math.abs(angle1) < angleTolerance &&
    Math.abs(angle2) < angleTolerance
  const isSameAngle = angleDiff < angleTolerance

  return isHorizontal || isVertical || isSameAngle
}

/**
 * Gets the direction of a segment (horizontal, vertical, or diagonal).
 */
function getSegmentDirection(
  start: Point,
  end: Point,
): "horizontal" | "vertical" | "diagonal" {
  const dx = Math.abs(end.x - start.x)
  const dy = Math.abs(end.y - start.y)

  if (dx > dy * 2) return "horizontal"
  if (dy > dx * 2) return "vertical"
  return "diagonal"
}

/**
 * Merges two trace paths into one if they are connected or close.
 * Returns the merged path or null if they can't be merged.
 */
function mergeTracePaths(
  path1: Point[],
  path2: Point[],
): Point[] | null {
  if (path1.length < 2 || path2.length < 2) return null

  const start1 = path1[0]
  const end1 = path1[path1.length - 1]
  const start2 = path2[0]
  const end2 = path2[path2.length - 1]

  // Calculate all pairwise distances between endpoints
  const distances = [
    { d: Math.hypot(end1.x - start2.x, end1.y - start2.y), type: "end1-start2" },
    { d: Math.hypot(end1.x - end2.x, end1.y - end2.y), type: "end1-end2" },
    { d: Math.hypot(start1.x - start2.x, start1.y - start2.y), type: "start1-start2" },
    { d: Math.hypot(start1.x - end2.x, start1.y - end2.y), type: "start1-end2" },
  ]

  distances.sort((a, b) => a.d - b.d)
  const closest = distances[0]

  // Merge based on which endpoints are closest
  switch (closest.type) {
    case "end1-start2":
      return [...path1, ...path2]
    case "end1-end2":
      return [...path1, ...[...path2].reverse()]
    case "start1-start2":
      return [...[...path1].reverse(), ...path2]
    case "start1-end2":
      return [...[...path1].reverse(), ...[...path2].reverse()]
  }

  return null
}

/**
 * Groups traces by their net ID.
 */
function groupTracesByNet(
  traces: SolvedTracePath[],
): Map<string, SolvedTracePath[]> {
  const netGroups = new Map<string, SolvedTracePath[]>()

  for (const trace of traces) {
    const netId = trace.dcConnNetId || trace.globalConnNetId
    if (!netId) continue

    if (!netGroups.has(netId)) {
      netGroups.set(netId, [])
    }
    netGroups.get(netId)!.push(trace)
  }

  return netGroups
}

/**
 * Finds pairs of traces that could be combined because they are:
 * 1. On the same net
 * 2. Parallel and close together
 */
function findCombinablePairs(
  traces: SolvedTracePath[],
  proximityThreshold: number,
): Array<[number, number, Point[], Point[]]> {
  const pairs: Array<[number, number, Point[], Point[]]> = []

  for (let i = 0; i < traces.length; i++) {
    for (let j = i + 1; j < traces.length; j++) {
      const trace1 = traces[i]
      const trace2 = traces[j]

      // Must be on the same net
      const net1 = trace1.dcConnNetId || trace1.globalConnNetId
      const net2 = trace2.dcConnNetId || trace2.globalConnNetId
      if (net1 !== net2) continue

      // Skip if already combined
      if (trace1.combinedWith?.includes(trace2.mspPairId)) continue

      const path1 = trace1.tracePath
      const path2 = trace2.tracePath

      if (path1.length < 2 || path2.length < 2) continue

      // Check if traces are parallel
      const isParallel = areParallel(
        path1[0],
        path1[path1.length - 1],
        path2[0],
        path2[path2.length - 1],
      )
      if (!isParallel) continue

      // Check if they are close enough to combine
      // Check each segment of path1 against path2
      let canCombine = true
      for (let si = 0; si < path1.length - 1 && canCombine; si++) {
        for (let sj = 0; sj < path2.length - 1 && canCombine; sj++) {
          // Calculate distance between midpoints of segments
          const mid1: Point = {
            x: (path1[si].x + path1[si + 1].x) / 2,
            y: (path1[si].y + path1[si + 1].y) / 2,
          }
          const mid2: Point = {
            x: (path2[sj].x + path2[sj + 1].x) / 2,
            y: (path2[sj].y + path2[sj + 1].y) / 2,
          }
          const dist = Math.hypot(mid1.x - mid2.x, mid1.y - mid2.y)

          if (dist > proximityThreshold) {
            canCombine = false
          }
        }
      }

      if (canCombine) {
        pairs.push([i, j, path1, path2])
      }
    }
  }

  return pairs
}

/**
 * Simplifies a trace path by removing redundant points on straight lines.
 */
function simplifyPath(path: Point[]): Point[] {
  if (path.length <= 2) return path

  const simplified: Point[] = [path[0]]
  let lastDirection: "h" | "v" | "d" | null = null

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]
    const curr = path[i]

    let direction: "h" | "v" | "d"
    const dx = Math.abs(curr.x - prev.x)
    const dy = Math.abs(curr.y - prev.y)

    if (dx > dy * 2) direction = "h"
    else if (dy > dx * 2) direction = "v"
    else direction = "d"

    if (direction !== lastDirection) {
      if (i > 1) {
        simplified.push(prev)
      }
      lastDirection = direction
    }
  }

  // Always add the last point
  simplified.push(path[path.length - 1])

  return simplified
}

/**
 * Main solver class that combines same-net trace segments that are close together.
 */
export class SameNetTraceCombiningSolver {
  private input: SameNetTraceCombiningSolverInput
  private proximityThreshold: number
  private combinedTraces: SolvedTracePath[] = []
  private combinedCount = 0

  constructor(input: SameNetTraceCombiningSolverInput) {
    this.input = input
    this.proximityThreshold = input.proximityThreshold ?? 0.5
    this.combinedTraces = [...input.traces]
  }

  /**
   * Combines trace segments on the same net that are close together.
   */
  solve(): SameNetTraceCombiningSolverOutput {
    let changed = true
    let iterations = 0
    const maxIterations = 100

    while (changed && iterations < maxIterations) {
      changed = false
      iterations++

      const pairs = findCombinablePairs(
        this.combinedTraces,
        this.proximityThreshold,
      )

      if (pairs.length === 0) break

      // Process the first pair
      const [idx1, idx2, path1, path2] = pairs[0]
      const trace1 = this.combinedTraces[idx1]
      const trace2 = this.combinedTraces[idx2]

      // Merge the paths
      const mergedPath = mergeTracePaths(path1, path2)
      if (!mergedPath) {
        // Mark as unable to combine and continue
        iterations++
        continue
      }

      // Simplify the merged path
      const simplifiedPath = simplifyPath(mergedPath)

      // Create combined trace info
      const combinedMspPairIds = [
        ...(trace1.mspConnectionPairIds || [trace1.mspPairId]),
        ...(trace2.mspConnectionPairIds || [trace2.mspPairId]),
      ]
      const combinedPinIds = [
        ...(trace1.pinIds || [trace1.pins[0].pinId, trace1.pins[1].pinId]),
        ...(trace2.pinIds || [trace2.pins[0].pinId, trace2.pins[1].pinId]),
      ]

      const combinedTrace: SolvedTracePath = {
        ...trace1,
        tracePath: simplifiedPath,
        mspPairId: combinedMspPairIds.join("+"),
        mspConnectionPairIds: combinedMspPairIds,
        pinIds: combinedPinIds,
        combinedWith: [trace2.mspPairId],
      }

      // Remove the old traces and add the combined one
      const newTraces = this.combinedTraces.filter(
        (_, i) => i !== idx1 && i !== idx2,
      )
      newTraces.push(combinedTrace)
      this.combinedTraces = newTraces

      this.combinedCount++
      changed = true
    }

    // Clean up the combinedWith property
    this.combinedTraces = this.combinedTraces.map((t) => {
      const { combinedWith, ...rest } = t
      return rest as SolvedTracePath
    })

    return {
      traces: this.combinedTraces,
      combinedCount: this.combinedCount,
    }
  }
}
