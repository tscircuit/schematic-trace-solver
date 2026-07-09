import type { SolvedTracePath } from "../../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { CloseSameNetTraceGroup } from "./findCloseSameNetTraceGroups"

export interface MergedTraceResult {
  originalTraceIds: string[]
  mergedPath: { x: number; y: number }[]
  netId: string
}

/**
 * Finds the closest pair of endpoints between two traces.
 */
const findClosestEndpointPair = (
  traceA: SolvedTracePath,
  traceB: SolvedTracePath,
): { aIdx: number; bIdx: number; aPoint: { x: number; y: number }; bPoint: { x: number; y: number }; distance: number } | null => {
  const endpointsA = [traceA.tracePath[0], traceA.tracePath[traceA.tracePath.length - 1]]
  const endpointsB = [traceB.tracePath[0], traceB.tracePath[traceB.tracePath.length - 1]]

  let best: { aIdx: number; bIdx: number; distance: number; aPoint: { x: number; y: number }; bPoint: { x: number; y: number } } | null = null

  for (let ai = 0; ai < endpointsA.length; ai++) {
    for (let bi = 0; bi < endpointsB.length; bi++) {
      const dx = endpointsA[ai].x - endpointsB[bi].x
      const dy = endpointsA[ai].y - endpointsB[bi].y
      const dist = Math.hypot(dx, dy)
      if (!best || dist < best.distance) {
        best = { aIdx: ai, bIdx: bi, aPoint: endpointsA[ai], bPoint: endpointsB[bi], distance: dist }
      }
    }
  }
  return best
}

/**
 * Builds an L-shaped connecting segment between two points.
 * Tries horizontal-then-vertical and vertical-then-horizontal, picks the shorter.
 */
const buildConnectingSegment = (
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number }[] => {
  const route1 = [
    { x: to.x, y: from.y }, // horizontal first, then vertical
  ]
  const route2 = [
    { x: from.x, y: to.y }, // vertical first, then horizontal
  ]

  // Pick the shorter L-route
  const len1 = Math.abs(to.x - from.x) + Math.abs(from.y - to.y)
  const len2 = Math.abs(from.x - to.x) + Math.abs(to.y - from.y)

  return len1 <= len2 ? route1 : route2
}

/**
 * Removes consecutive duplicate points from a path.
 */
const deduplicatePath = (points: { x: number; y: number }[]) => {
  const result: { x: number; y: number }[] = []
  for (const p of points) {
    const last = result[result.length - 1]
    if (!last || last.x !== p.x || last.y !== p.y) {
      result.push(p)
    }
  }
  return result
}

/**
 * Given two same-net traces whose endpoints are close (or overlapping),
 * merges them into a single continuous path.
 *
 * Strategy:
 * 1. Find the closest endpoint pair between the two traces
 * 2. Determine the direction of each trace from the closest endpoint
 * 3. Construct a merged path: traceA (from far endpoint toward merge point) +
 *    connecting segment + traceB (from merge point toward far endpoint)
 * 4. Deduplicate consecutive identical points
 */
export const mergeTwoSameNetTraces = (
  traceA: SolvedTracePath,
  traceB: SolvedTracePath,
  maxMergeDistance: number = 0.5,
): { x: number; y: number }[] | null => {
  const pair = findClosestEndpointPair(traceA, traceB)
  if (!pair || pair.distance > maxMergeDistance) return null

  // Determine which endpoint of traceA and traceB are the merge ends vs far ends
  const aPath = traceA.tracePath
  const bPath = traceB.tracePath

  // Build merged path
  // traceA from its far end to the closest endpoint
  const aPoints = pair.aIdx === 0 ? [...aPath] : [...aPath].reverse()
  const bPoints = pair.bIdx === 0 ? [...bPath] : [...bPath].reverse()

  // aPoints now starts at the merge-end of traceA and ends at the far end
  // bPoints starts at the far end of traceB and ends at the merge-end
  // We need: traceA far → ... → traceA merge → connector → traceB merge → ... → traceB far
  const aFromFarToMerge = [...aPoints].reverse()
  // aFromFarToMerge[0] is the far end, aFromFarToMerge[last] is the merge end

  // Build the connector from traceA's merge-end to traceB's merge-end
  const aMergePoint = aFromFarToMerge[aFromFarToMerge.length - 1]
  const bMergePoint = bPoints[0]
  const connector = buildConnectingSegment(aMergePoint, bMergePoint)

  // bPoints already starts at the merge-end and goes to the far end
  // But we need to skip the first point of bPoints to avoid duplicating the merge point
  const bFromMergeToFar = bPoints.slice(1)

  const merged = deduplicatePath([
    ...aFromFarToMerge,
    ...connector,
    ...bFromMergeToFar,
  ])

  return merged
}

/**
 * Takes groups of close same-net traces and attempts to merge each group
 * into a single continuous trace path.
 */
export const mergeCloseSameNetTraceGroups = (
  groups: CloseSameNetTraceGroup[],
  allTraces: SolvedTracePath[],
  maxMergeDistance: number = 0.5,
): MergedTraceResult[] => {
  const traceMap = new Map<string, SolvedTracePath>()
  for (const t of allTraces) {
    traceMap.set(t.mspPairId, t)
  }

  const results: MergedTraceResult[] = []

  for (const group of groups) {
    if (group.traceIds.length < 2) continue

    // Get the traces in this group
    const groupTraces = group.traceIds
      .map((id) => traceMap.get(id))
      .filter((t): t is SolvedTracePath => t !== undefined)

    if (groupTraces.length < 2) continue

    // Merge sequentially: merge first two, then merge result with next, etc.
    // For now, simple pairwise merge of first two traces in the group
    const merged = mergeTwoSameNetTraces(groupTraces[0], groupTraces[1], maxMergeDistance)

    if (merged) {
      results.push({
        originalTraceIds: [groupTraces[0].mspPairId, groupTraces[1].mspPairId],
        mergedPath: merged,
        netId: group.netId,
      })
    }
  }

  return results
}
