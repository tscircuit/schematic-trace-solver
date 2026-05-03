import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { hasCollisions } from "./hasCollisions"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-6

/**
 * Returns true if two numeric ranges [aMin, aMax] and [bMin, bMax] are
 * contiguous or overlapping (gap <= gapTolerance).
 */
function rangesContiguous(
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
  gapTolerance = 0.1,
): boolean {
  // gap between ranges = max(0, max(mins) - min(maxes))
  const gap = Math.max(0, Math.max(aMin, bMin) - Math.min(aMax, bMax))
  return gap <= gapTolerance
}

type CollinearSegment = {
  traceIndex: number
  segmentIndex: number // index of first point of the segment in tracePath
  orientation: "horizontal" | "vertical"
  /** shared coordinate: Y for horizontal, X for vertical */
  sharedCoord: number
  rangeMin: number
  rangeMax: number
}

function extractCollinearSegments(
  path: Point[],
  traceIndex: number,
): CollinearSegment[] {
  const segments: CollinearSegment[] = []
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
        sharedCoord: (p1.y + p2.y) / 2,
        rangeMin: Math.min(p1.x, p2.x),
        rangeMax: Math.max(p1.x, p2.x),
      })
    } else if (dx < EPS && dy > EPS) {
      segments.push({
        traceIndex,
        segmentIndex: i,
        orientation: "vertical",
        sharedCoord: (p1.x + p2.x) / 2,
        rangeMin: Math.min(p1.y, p2.y),
        rangeMax: Math.max(p1.y, p2.y),
      })
    }
  }
  return segments
}

/**
 * Merges segments from two different traces in the same net that are collinear
 * (same axis, same shared coordinate within EPS) and contiguous/overlapping.
 *
 * Both traces are extended to cover the union of their ranges.
 * If the merged path would collide with chip obstacles, the merge is skipped.
 *
 * Implements issue #29: "3 pins in a row connected by one net result in 2 segments;
 * this should be merged to 1."
 */
export function mergeSameNetCollinearTraces(
  allTraces: SolvedTracePath[],
  inputProblem: InputProblem,
  gapTolerance = 0.1,
): SolvedTracePath[] {
  const updatedPaths: Point[][] = allTraces.map((t) => [...t.tracePath])
  const chipObstacles = getObstacleRects(inputProblem)

  // Group trace indices by globalConnNetId
  const netGroups = new Map<string, number[]>()
  for (let i = 0; i < allTraces.length; i++) {
    const netId = allTraces[i]!.globalConnNetId
    if (!netGroups.has(netId)) netGroups.set(netId, [])
    netGroups.get(netId)!.push(i)
  }

  for (const [, traceIndices] of netGroups) {
    if (traceIndices.length < 2) continue

    // Use a set to track which (traceA, traceB) pairs we've already merged
    // to avoid infinite loops from re-detecting the same pair
    const mergedPairs = new Set<string>()

    let changed = true
    let safetyIter = 0
    const maxIter = allTraces.length * allTraces.length * 10

    while (changed && safetyIter < maxIter) {
      changed = false
      safetyIter++

      // Extract all segments from all traces in this net group (using current paths)
      const allSegments: CollinearSegment[] = []
      for (const ti of traceIndices) {
        const segs = extractCollinearSegments(updatedPaths[ti]!, ti)
        allSegments.push(...segs)
      }

      // Find collinear contiguous pairs across different traces
      for (let a = 0; a < allSegments.length && !changed; a++) {
        for (let b = a + 1; b < allSegments.length && !changed; b++) {
          const segA = allSegments[a]!
          const segB = allSegments[b]!

          if (segA.traceIndex === segB.traceIndex) continue
          if (segA.orientation !== segB.orientation) continue

          // Must be on the same axis
          if (Math.abs(segA.sharedCoord - segB.sharedCoord) > EPS) continue

          // Must be contiguous or overlapping
          if (
            !rangesContiguous(
              segA.rangeMin,
              segA.rangeMax,
              segB.rangeMin,
              segB.rangeMax,
              gapTolerance,
            )
          )
            continue

          // Skip if already identical ranges (fully merged)
          if (
            Math.abs(segA.rangeMin - segB.rangeMin) < EPS &&
            Math.abs(segA.rangeMax - segB.rangeMax) < EPS
          )
            continue

          const pairKey = `${Math.min(segA.traceIndex, segB.traceIndex)}-${Math.max(segA.traceIndex, segB.traceIndex)}-${segA.orientation}-${segA.sharedCoord.toFixed(6)}`
          if (mergedPairs.has(pairKey)) continue

          // Attempt to merge: extend both paths to cover the union range
          const mergedMin = Math.min(segA.rangeMin, segB.rangeMin)
          const mergedMax = Math.max(segA.rangeMax, segB.rangeMax)

          const pathA = [...updatedPaths[segA.traceIndex]!]
          const pathB = [...updatedPaths[segB.traceIndex]!]
          const piA = segA.segmentIndex
          const piB = segB.segmentIndex

          if (segA.orientation === "horizontal") {
            const yA = pathA[piA]!.y
            if (pathA[piA]!.x <= pathA[piA + 1]!.x) {
              pathA[piA] = { x: mergedMin, y: yA }
              pathA[piA + 1] = { x: mergedMax, y: yA }
            } else {
              pathA[piA] = { x: mergedMax, y: yA }
              pathA[piA + 1] = { x: mergedMin, y: yA }
            }
            const yB = pathB[piB]!.y
            if (pathB[piB]!.x <= pathB[piB + 1]!.x) {
              pathB[piB] = { x: mergedMin, y: yB }
              pathB[piB + 1] = { x: mergedMax, y: yB }
            } else {
              pathB[piB] = { x: mergedMax, y: yB }
              pathB[piB + 1] = { x: mergedMin, y: yB }
            }
          } else {
            // Vertical
            const xA = pathA[piA]!.x
            if (pathA[piA]!.y <= pathA[piA + 1]!.y) {
              pathA[piA] = { x: xA, y: mergedMin }
              pathA[piA + 1] = { x: xA, y: mergedMax }
            } else {
              pathA[piA] = { x: xA, y: mergedMax }
              pathA[piA + 1] = { x: xA, y: mergedMin }
            }
            const xB = pathB[piB]!.x
            if (pathB[piB]!.y <= pathB[piB + 1]!.y) {
              pathB[piB] = { x: xB, y: mergedMin }
              pathB[piB + 1] = { x: xB, y: mergedMax }
            } else {
              pathB[piB] = { x: xB, y: mergedMax }
              pathB[piB + 1] = { x: xB, y: mergedMin }
            }
          }

          const simplA = simplifyPath(pathA)
          const simplB = simplifyPath(pathB)

          // Check for collisions
          if (
            hasCollisions(simplA, chipObstacles) ||
            hasCollisions(simplB, chipObstacles)
          ) {
            mergedPairs.add(pairKey)
            continue
          }

          updatedPaths[segA.traceIndex] = simplA
          updatedPaths[segB.traceIndex] = simplB
          mergedPairs.add(pairKey)
          changed = true
        }
      }
    }
  }

  return allTraces.map((trace, i) => ({
    ...trace,
    tracePath: updatedPaths[i]!,
  }))
}
