import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { hasCollisions } from "./hasCollisions"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-6

type ParallelSegment = {
  traceIndex: number
  segmentIndex: number
  orientation: "horizontal" | "vertical"
  /** The shared coordinate (Y for horizontal, X for vertical) */
  sharedCoord: number
  /** The range on the other axis [min, max] */
  rangeMin: number
  rangeMax: number
  /** Whether this is the first or last segment in the trace */
  isEndpoint: boolean
}

function extractParallelSegments(
  trace: SolvedTracePath,
  traceIndex: number,
): ParallelSegment[] {
  const segments: ParallelSegment[] = []
  const path = trace.tracePath
  const lastSegIdx = path.length - 2

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]!
    const p2 = path[i + 1]!
    const dx = Math.abs(p1.x - p2.x)
    const dy = Math.abs(p1.y - p2.y)

    if (dy < EPS && dx > EPS) {
      segments.push({
        traceIndex,
        segmentIndex: i,
        orientation: "horizontal",
        sharedCoord: p1.y,
        rangeMin: Math.min(p1.x, p2.x),
        rangeMax: Math.max(p1.x, p2.x),
        isEndpoint: i === 0 || i === lastSegIdx,
      })
    } else if (dx < EPS && dy > EPS) {
      segments.push({
        traceIndex,
        segmentIndex: i,
        orientation: "vertical",
        sharedCoord: p1.x,
        rangeMin: Math.min(p1.y, p2.y),
        rangeMax: Math.max(p1.y, p2.y),
        isEndpoint: i === 0 || i === lastSegIdx,
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
 * Merges same-net trace segments that are parallel and close together
 * (within a distance threshold) by snapping them to their midpoint coordinate.
 *
 * Implements issue #34: "Merge same-net trace lines that are close together
 * (make at the same Y or same X)".
 *
 * Only merges internal (non-endpoint) segments to avoid breaking pin connectivity.
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

    // Collect all internal segments from this net group
    const allSegments: ParallelSegment[] = []
    for (const ti of traceIndices) {
      const segs = extractParallelSegments(
        { ...allTraces[ti]!, tracePath: updatedPaths[ti]! },
        ti,
      )
      // Only consider non-endpoint (internal) segments for close-merge
      allSegments.push(...segs.filter((s) => !s.isEndpoint))
    }

    // Find pairs that are parallel, within threshold distance, and overlapping
    for (let a = 0; a < allSegments.length; a++) {
      for (let b = a + 1; b < allSegments.length; b++) {
        const segA = allSegments[a]!
        const segB = allSegments[b]!

        if (segA.traceIndex === segB.traceIndex) continue
        if (segA.orientation !== segB.orientation) continue

        const dist = Math.abs(segA.sharedCoord - segB.sharedCoord)
        // Skip if identical (those are handled by collinear merge) or too far
        if (dist < EPS || dist > threshold) continue

        if (
          !rangesOverlap(
            segA.rangeMin,
            segA.rangeMax,
            segB.rangeMin,
            segB.rangeMax,
          )
        )
          continue

        const midCoord = (segA.sharedCoord + segB.sharedCoord) / 2

        // Apply the snap to copies of both traces' paths
        const pathA = [...updatedPaths[segA.traceIndex]!]
        const pathB = [...updatedPaths[segB.traceIndex]!]
        const piA = segA.segmentIndex
        const piB = segB.segmentIndex

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

        const simplA = simplifyPath(pathA)
        const simplB = simplifyPath(pathB)

        // Revert if the snapped path collides with chips
        if (
          hasCollisions(simplA, chipObstacles) ||
          hasCollisions(simplB, chipObstacles)
        ) {
          continue
        }

        updatedPaths[segA.traceIndex] = simplA
        updatedPaths[segB.traceIndex] = simplB

        // Update segment coords so later iterations use the updated position
        segA.sharedCoord = midCoord
        segB.sharedCoord = midCoord
      }
    }
  }

  return allTraces.map((trace, i) => ({
    ...trace,
    tracePath: updatedPaths[i]!,
  }))
}
