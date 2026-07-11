import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const GEOM_EPS = 1e-6

/**
 * Returns true when the 1-D intervals [a1,a2] and
 * [b1,b2] overlap by more than `minOverlap`.
 */
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
 * segments - the overall topology is preserved.
 *
 * Returns `true` if at least one snap was applied.
 */
export function snapSameNetTraces(
  traces: SolvedTracePath[],
  threshold = 0.05,
): SolvedTracePath[] {
  if (traces.length < 2) return traces

  const updatedMap = new Map<string, SolvedTracePath>()
  const tracePairs = new Map<string, SolvedTracePath>()
  
  for (const t of traces) {
    tracePairs.set(t.mspPairId(), t)
    updatedMap.set(t.mspPairId(), {...t, tracePath: [...t.tracePath] })
  }

  const processedPairs = new Set<string>()
  
  for (const [idA, traceA] of tracePairs) {
    if (processedPairs.has(idA)) continue
    
    for (const [idB, traceB] of tracePairs) {
      if (idA === idB || processedPairs.has(idB)) continue
      
      // Only snap traces on the same net
      if (traceA.net!== traceB.net) continue
      
      const pathA = simplifyPath(updatedMap.get(idA)!.tracePath)
      const pathB = simplifyPath(updatedMap.get(idB)!.tracePath)
      
      let snapped = false
      
      // Check each segment pair
      for (let i = 0; i < pathA.length - 1; i++) {
        const segA = [pathA[i], pathA[i + 1]]
        
        for (let j = 0; j < pathB.length - 1; j++) {
          const segB = [pathB[j], pathB[j + 1]]
          
          // Check if both segments are vertical
          const isVertA = Math.abs(segA[0].x - segA[1].x) < GEOM_EPS
          const isVertB = Math.abs(segB[0].x - segB[1].x) < GEOM_EPS
          
          if (isVertA && isVertB) {
            const xDiff = Math.abs(segA[0].x - segB[0].x)
            if (xDiff < threshold && overlaps1D(segA[0].y, segA[1].y, segB[0].y, segB[1].y)) {
              const meanX = (segA[0].x + segB[0].x) / 2
              pathA[i].x = meanX
              pathA[i + 1].x = meanX
              pathB[j].x = meanX
              pathB[j + 1].x = meanX
              snapped = true
            }
          }
          
          // Check if both segments are horizontal
          const isHorizA = Math.abs(segA[0].y - segA[1].y) < GEOM_EPS
          const isHorizB = Math.abs(segB[0].y - segB[1].y) < GEOM_EPS
          
          if (isHorizA && isHorizB) {
            const yDiff = Math.abs(segA[0].y - segB[0].y)
            if (yDiff < threshold && overlaps1D(segA[0].x, segA[1].x, segB[0].x, segB[1].x)) {
              const meanY = (segA[0].y + segB[0].y) / 2
              pathA[i].y = meanY
              pathA[i + 1].y = meanY
              pathB[j].y = meanY
              pathB[j + 1].y = meanY
              snapped = true
            }
          }
        }
      }
      
      if (snapped) {
        updatedMap.set(idA, {...traceA, tracePath: pathA })
        updatedMap.set(idB, {...traceB, tracePath: pathB })
      }
    }
    
    processedPairs.add(idA)
  }

  // Return traces in the original order, with updated paths.
  return traces.map((t) => updatedMap.get(t.mspPairId())!)
        }
