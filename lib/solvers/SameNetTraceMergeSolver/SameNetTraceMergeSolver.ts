import type { BaseSolver } from "../BaseSolver/BaseSolver"

export const MERGE_DISTANCE_THRESHOLD = 0.02

type Point = { x: number; y: number }

type TracePath = {
  mspPairId?: string
  netId?: string
  points?: Point[]
  [key: string]: any
}

function normalizePoints(points: Point[]): Point[] {
  if (points.length < 2) return points
  const first = points[0]
  const last = points[points.length - 1]
  // ensure consistent ordering
  if (first.x > last.x || (first.x === last.x && first.y > last.y)) {
    return [...points].reverse()
  }
  return points
}

function isHorizontalSegment(p1: Point, p2: Point): boolean {
  return Math.abs(p1.y - p2.y) < MERGE_DISTANCE_THRESHOLD
}

function isVerticalSegment(p1: Point, p2: Point): boolean {
  return Math.abs(p1.x - p2.x) < MERGE_DISTANCE_THRESHOLD
}

function rangesOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
  const lo1 = Math.min(a1, a2)
  const hi1 = Math.max(a1, a2)
  const lo2 = Math.min(b1, b2)
  const hi2 = Math.max(b1, b2)
  return lo1 <= hi2 + MERGE_DISTANCE_THRESHOLD && lo2 <= hi1 + MERGE_DISTANCE_THRESHOLD
}

/**
 * Try to merge two 2-point trace paths that lie on the same axis.
 * Returns merged TracePath or null if they can't be merged.
 */
function tryMergeTraces(a: TracePath, b: TracePath): TracePath | null {
  const ap = a.points
  const bp = b.points
  if (!ap || !bp || ap.length !== 2 || bp.length !== 2) return null

  const [a1, a2] = normalizePoints(ap)
  const [b1, b2] = normalizePoints(bp)

  // Both horizontal
  if (isHorizontalSegment(a1, a2) && isHorizontalSegment(b1, b2)) {
    if (Math.abs(a1.y - b1.y) <= MERGE_DISTANCE_THRESHOLD) {
      if (rangesOverlap(a1.x, a2.x, b1.x, b2.x)) {
        const midY = (a1.y + b1.y) / 2
        return {
          ...a,
          points: [
            { x: Math.min(a1.x, b1.x), y: midY },
            { x: Math.max(a2.x, b2.x), y: midY },
          ],
        }
      }
    }
  }

  // Both vertical
  if (isVerticalSegment(a1, a2) && isVerticalSegment(b1, b2)) {
    if (Math.abs(a1.x - b1.x) <= MERGE_DISTANCE_THRESHOLD) {
      if (rangesOverlap(a1.y, a2.y, b1.y, b2.y)) {
        const midX = (a1.x + b1.x) / 2
        return {
          ...a,
          points: [
            { x: midX, y: Math.min(a1.y, b1.y) },
            { x: midX, y: Math.max(a2.y, b2.y) },
          ],
        }
      }
    }
  }

  return null
}

export class SameNetTraceMergeSolver {
  solve(input: { traces?: TracePath[] }): { traces: TracePath[] } {
    let traces = (input.traces ?? []).slice()
    let changed = true

    while (changed) {
      changed = false
      const used = new Set<number>()
      const result: TracePath[] = []

      for (let i = 0; i < traces.length; i++) {
        if (used.has(i)) continue
        let current = traces[i]

        for (let j = i + 1; j < traces.length; j++) {
          if (used.has(j)) continue
          const candidate = traces[j]

          // Must be same net
          if (
            current.netId !== undefined &&
            candidate.netId !== undefined &&
            current.netId !== candidate.netId
          )
            continue

          const merged = tryMergeTraces(current, candidate)
          if (merged !== null) {
            current = merged
            used.add(j)
            changed = true
          }
        }

        result.push(current)
        used.add(i)
      }

      traces = result
    }

    return { traces }
  }
}
