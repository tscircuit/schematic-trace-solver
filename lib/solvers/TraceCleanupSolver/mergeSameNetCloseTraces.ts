import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const CLOSE_THRESHOLD = 0.001

/**
 * Merges trace lines from the same net that are nearly identical
 * at the same X or Y coordinate into a single clean line.
 */
export const mergeSameNetCloseTraces = (
  traces: SolvedTracePath[],
): SolvedTracePath[] => {
  const result: SolvedTracePath[] = [...traces]

  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const traceA = result[i]
      const traceB = result[j]

      if (traceA.netId !== traceB.netId) continue

      const merged = tryMergeTraces(traceA, traceB)
      if (merged) {
        result[i] = merged
        result.splice(j, 1)
        j--
      }
    }
  }

  return result
}

function tryMergeTraces(
  traceA: SolvedTracePath,
  traceB: SolvedTracePath,
): SolvedTracePath | null {
  const pathA = traceA.tracePath
  const pathB = traceB.tracePath

  for (let a = 0; a < pathA.length - 1; a++) {
    const a1 = pathA[a]
    const a2 = pathA[a + 1]

    for (let b = 0; b < pathB.length - 1; b++) {
      const b1 = pathB[b]
      const b2 = pathB[b + 1]

      const isHorizontalA = Math.abs(a1.y - a2.y) < CLOSE_THRESHOLD
      const isHorizontalB = Math.abs(b1.y - b2.y) < CLOSE_THRESHOLD
      const isVerticalA = Math.abs(a1.x - a2.x) < CLOSE_THRESHOLD
      const isVerticalB = Math.abs(b1.x - b2.x) < CLOSE_THRESHOLD

      if (
        isHorizontalA &&
        isHorizontalB &&
        Math.abs(a1.y - b1.y) < CLOSE_THRESHOLD
      ) {
        const minX = Math.min(a1.x, a2.x, b1.x, b2.x)
        const maxX = Math.max(a1.x, a2.x, b1.x, b2.x)
        const y = (a1.y + b1.y) / 2
        return { ...traceA, tracePath: [{ x: minX, y }, { x: maxX, y }] }
      }

      if (
        isVerticalA &&
        isVerticalB &&
        Math.abs(a1.x - b1.x) < CLOSE_THRESHOLD
      ) {
        const minY = Math.min(a1.y, a2.y, b1.y, b2.y)
        const maxY = Math.max(a1.y, a2.y, b1.y, b2.y)
        const x = (a1.x + b1.x) / 2
        return { ...traceA, tracePath: [{ x, y: minY }, { x, y: maxY }] }
      }
    }
  }

  return null
}
