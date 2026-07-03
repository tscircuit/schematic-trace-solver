import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const GEOM_EPS = 1e-6
// Replace lines 5-11 with this:
function isVertical(p, next) {
  return (
    Math.abs(p.x - next.x) < 1e-6 &&
    Math.abs(p.y - next.y) > 1e-6
  );
}
function overlaps1D(
  a1: number,
  a2: number,
  b1: number,
  b2: number,
  minOverlap = GEOM_EPS,
): boolean {
  const minA = Math.min(a1, a2)
  const maxA = Math.max(a1, a2)
  const minB = Math.min(b1, b2)
  const maxB = Math.max(b1, b2)
  return Math.min(maxA, maxB) - Math.max(minA, minB) > minOverlap
}

/**
 * Mutates close parallel segments between two same-net traces so they share
 * the exact same axis-aligned coordinate.
 *
 * For two vertical segments (same X within `threshold`) whose Y ranges
 * overlap, we snap both to the arithmetic mean X.
 *
 * For two horizontal segments (same Y within `threshold`) whose X ranges
 * overlap, we snap both to the arithmetic mean Y.
 *
 * Because the paths are orthogonal, adjusting a single coordinate on the two
 * endpoints of a segment only elongates or shortens the adjacent perpendicular
 * segments — the overall topology is preserved.
 *
 * Returns `true` if at least one snap was applied.
 */
function snapBetweenTraces(
  traceA: SolvedTracePath,
  traceB: SolvedTracePath,
  threshold: number,
): boolean {
  const pathA = traceA.tracePath
  const pathB = traceB.tracePath
  let snapped = false

  // Line 49
for (let sa = 0; sa < pathA.length - 1; sa++) {
  const a1 = pathA[sa]!
  const a2 = pathA[sa + 1]!

  // Line 53
  const aIsVert = Math.abs(a1.x - a2.x) < GEOM_EPS
  const aIsHorz = Math.abs(a1.y - a2.y) < GEOM_EPS
  if (!aIsVert && !aIsHorz) continue

  // Line 57
  for (let sb = 0; sb < pathB.length - 1; sb++) {
    const b1 = pathB[sb]!
    const b2 = pathB[sb + 1]!

      const bIsVert = Math.abs(b1.x - b2.x) < GEOM_EPS
      const bIsHorz = Math.abs(b1.y - b2.y) < GEOM_EPS
      if (!bIsVert && !bIsHorz) continue

      if (aIsVert && bIsVert) {
        const dist = Math.abs(a1.x - b1.x)
        if (dist > GEOM_EPS && dist < threshold) {
          if (overlaps1D(a1.y, a2.y, b1.y, b2.y)) {
            const targetX = (a1.x + b1.x) / 2
            a1.x = targetX
            a2.x = targetX
            b1.x = targetX
            b2.x = targetX
            snapped = true
          }
        }
      } else if (aIsHorz && bIsHorz) {
        const dist = Math.abs(a1.y - b1.y)
        if (dist > GEOM_EPS && dist < threshold) {
          if (overlaps1D(a1.x, a2.x, b1.x, b2.x)) {
            const targetY = (a1.y + b1.y) / 2
            a1.y = targetY
            a2.y = targetY
            b1.y = targetY
            b2.y = targetY
            snapped = true
          }
        }
      }
    }
  }

  if (snapped) {
    traceA.tracePath = simplifyPath(traceA.tracePath)
    traceB.tracePath = simplifyPath(traceB.tracePath)
  }

  return snapped
}

/**
 * Snaps parallel segments of same-net traces that are close together onto the
 * exact same X or Y coordinate.
 *
 * Traces are grouped by `globalConnNetId`.  Within each group every pair of
 * traces is checked for close parallel segments, and those segments are
 * snapped to their midpoint coordinate.  The process repeats until no more
 * snaps are possible (or `maxPasses` is reached) so that cascading fixes are
 * applied correctly.
 *
 * @param traces       All solved trace paths for this schematic.
 * @param snapThreshold  Maximum perpendicular distance between two parallel
 *                     same-net segments for them to be considered "close
 *                     enough" to snap.  Defaults to 0.05.
 * @param maxPasses    Safety limit on the number of iterations.
 */
export function snapSameNetTraces(
  traces: SolvedTracePath[],
  snapThreshold = 0.05,
  maxPasses = 20,
): SolvedTracePath[] {
  if (traces.length === 0) return traces

  // Group traces by net, keeping a mutable clone of each path.
  const updatedMap = new Map<string, SolvedTracePath>(
    traces.map((t) => [
      t.mspPairId,
      {
        ...t,
        tracePath: t.tracePath.map((p) => ({ ...p })),
      },
    ]),
  )

  // Build net → trace list mapping using the mutable clones.
  const netGroups = new Map<string, SolvedTracePath[]>()
  for (const trace of updatedMap.values()) {
    const netId = trace.globalConnNetId
    if (!netGroups.has(netId)) netGroups.set(netId, [])
    netGroups.get(netId)!.push(trace)
  }

  // Iterate until stable or max passes reached.
  for (let pass = 0; pass < maxPasses; pass++) {
    let anySnapped = false

    for (const netTraces of netGroups.values()) {
      if (netTraces.length < 2) continue

      for (let i = 0; i < netTraces.length; i++) {
        for (let j = i + 1; j < netTraces.length; j++) {
          const didSnap = snapBetweenTraces(
            netTraces[i]!,
            netTraces[j]!,
            snapThreshold,
          )
          if (didSnap) anySnapped = true
        }
      }
    }

    if (!anySnapped) break
  }

  // Return traces in the original order, with updated paths.
  return traces.map((t) => updatedMap.get(t.mspPairId)!)
}
