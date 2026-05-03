import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { hasCollisions } from "./hasCollisions"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-6

type Segment = {
  traceIndex: number
  pointIndex: number
  orientation: "horizontal" | "vertical"
  /** The shared coordinate (Y for horizontal, X for vertical) */
  sharedCoord: number
  /** The range on the other axis [min, max] */
  rangeMin: number
  rangeMax: number
}

function extractSegments(
  trace: SolvedTracePath,
  traceIndex: number,
): Segment[] {
  const segments: Segment[] = []
  const path = trace.tracePath
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]!
    const p2 = path[i + 1]!
    const dx = Math.abs(p1.x - p2.x)
    const dy = Math.abs(p1.y - p2.y)

    if (dy < EPS && dx > EPS) {
      // Horizontal segment
      segments.push({
        traceIndex,
        pointIndex: i,
        orientation: "horizontal",
        sharedCoord: p1.y,
        rangeMin: Math.min(p1.x, p2.x),
        rangeMax: Math.max(p1.x, p2.x),
      })
    } else if (dx < EPS && dy > EPS) {
      // Vertical segment
      segments.push({
        traceIndex,
        pointIndex: i,
        orientation: "vertical",
        sharedCoord: p1.x,
        rangeMin: Math.min(p1.y, p2.y),
        rangeMax: Math.max(p1.y, p2.y),
      })
    }
  }
  return segments
}

function rangesOverlap(
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
): boolean {
  return aMin < bMax - EPS && bMin < aMax - EPS
}

/**
 * Checks if a segment is an endpoint segment (first or last segment of the trace).
 * We skip these to avoid breaking pin connectivity.
 */
function isEndpointSegment(pointIndex: number, pathLength: number): boolean {
  return pointIndex === 0 || pointIndex === pathLength - 2
}

/**
 * Merges same-net trace segments that are close together (parallel, within threshold,
 * overlapping ranges) by snapping them to a shared coordinate (midpoint).
 */
export function mergeSameNetCloseTraces(
  allTraces: SolvedTracePath[],
  inputProblem: InputProblem,
  threshold = 0.15,
): SolvedTracePath[] {
  const updatedPaths: Point[][] = allTraces.map((t) => [...t.tracePath])
  const chipObstacles = getObstacleRects(inputProblem)

  // Group traces by globalConnNetId
  const netGroups = new Map<string, number[]>()
  for (let i = 0; i < allTraces.length; i++) {
    const netId = allTraces[i]!.globalConnNetId
    if (!netGroups.has(netId)) netGroups.set(netId, [])
    netGroups.get(netId)!.push(i)
  }

  for (const [, traceIndices] of netGroups) {
    if (traceIndices.length < 2) continue

    // Extract all internal segments from traces in this net
    const allSegments: Segment[] = []
    for (const ti of traceIndices) {
      const segs = extractSegments(allTraces[ti]!, ti)
      for (const seg of segs) {
        if (!isEndpointSegment(seg.pointIndex, allTraces[ti]!.tracePath.length)) {
          allSegments.push(seg)
        }
      }
    }

    // Find mergeable pairs
    for (let a = 0; a < allSegments.length; a++) {
      for (let b = a + 1; b < allSegments.length; b++) {
        const segA = allSegments[a]!
        const segB = allSegments[b]!

        if (segA.traceIndex === segB.traceIndex) continue
        if (segA.orientation !== segB.orientation) continue

        const dist = Math.abs(segA.sharedCoord - segB.sharedCoord)
        if (dist < EPS || dist > threshold) continue

        if (!rangesOverlap(segA.rangeMin, segA.rangeMax, segB.rangeMin, segB.rangeMax)) continue

        const midCoord = (segA.sharedCoord + segB.sharedCoord) / 2

        // Apply the snap to both traces' paths
        const pathA = updatedPaths[segA.traceIndex]!
        const pathB = updatedPaths[segB.traceIndex]!
        const piA = segA.pointIndex
        const piB = segB.pointIndex

        if (segA.orientation === "horizontal") {
          pathA[piA] = { x: pathA[piA]!.x, y: midCoord }
          pathA[piA + 1] = { x: pathA[piA + 1]!.x, y: midCoord }
          pathB[piB] = { x: pathB[piB]!.x, y: midCoord }
          pathB[piB + 1] = { x: pathB[piB + 1]!.x, y: midCoord }
        } else {
          pathA[piA] = { x: midCoord, y: pathA[piA]!.y }
          pathA[piA + 1] = { x: midCoord, y: pathA[piA + 1]!.y }
          pathB[piB] = { x: midCoord, y: pathB[piB]!.y }
          pathB[piB + 1] = { x: midCoord, y: pathB[piB + 1]!.y }
        }

        // Update the segment shared coords
        segA.sharedCoord = midCoord
        segB.sharedCoord = midCoord
      }
    }
  }

  // Validate: if a snapped path collides with chip obstacles, revert it
  return allTraces.map((trace, i) => {
    const newPath = simplifyPath(updatedPaths[i]!)
    if (hasCollisions(newPath, chipObstacles)) {
      return trace // revert
    }
    return { ...trace, tracePath: newPath }
  })
}
