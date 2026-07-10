import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

function snapBetweenTraces(
  traceA: SolvedTracePath,
  traceB: SolvedTracePath,
  threshold: number,
): boolean {
  const pathA = traceA.tracePath
  const pathB = traceB.tracePath
  let snapped = false

  
for (let sa = 0; sa < pathA.length - 1; sa++) {
  const a1 = pathA[sa]!
  const a2 = pathA[sa + 1]!

  
  const aIsVert = Math.abs(a1.x - a2.x) < GEOM_EPS
  const aIsHorz = Math.abs(a1.y - a2.y) < GEOM_EPS
  if (!aIsVert && !aIsHorz) continue

  
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

  
  const updatedMap = new Map<string, SolvedTracePath>(
    traces.map((t) => [
      t.mspPairId,
      {
        ...t,
        tracePath: t.tracePath.map((p) => ({ ...p })),
      },
    ]),
  )

  
  const netGroups = new Map<string, SolvedTracePath[]>()
  for (const trace of updatedMap.values()) {
    const netId = trace.globalConnNetId
    if (!netGroups.has(netId)) netGroups.set(netId, [])
    netGroups.get(netId)!.push(trace)
  }

  
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

  
  return traces.map((t) => updatedMap.get(t.mspPairId)!)
}
