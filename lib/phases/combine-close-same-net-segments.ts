/**
 * combine-close-same-net-segments.ts
 *
 * NOTE: This phase is intentionally separate from `combineCloseSameNetTraceSegments`.
 * While `combineCloseSameNetTraceSegments` works on the full SchematicTrace objects
 * (with edge arrays), this phase operates on a flattened segment representation
 * and is intended for use in pipeline stages where traces have already been
 * decomposed into individual segments.
 *
 * Related to issue #29.
 */
import type { SchematicTrace } from "@tscircuit/props"

const CLOSE_THRESHOLD = 0.1

interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
  net_name?: string
  [key: string]: unknown
}

function isClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= CLOSE_THRESHOLD
}

function isHorizontal(seg: Segment): boolean {
  return Math.abs(seg.y1 - seg.y2) < 1e-9
}

function isVertical(seg: Segment): boolean {
  return Math.abs(seg.x1 - seg.x2) < 1e-9
}

function horizontalSegmentsAreClose(a: Segment, b: Segment): boolean {
  if (!isClose(a.y1, b.y1)) return false
  const aX1 = Math.min(a.x1, a.x2)
  const aX2 = Math.max(a.x1, a.x2)
  const bX1 = Math.min(b.x1, b.x2)
  const bX2 = Math.max(b.x1, b.x2)
  return aX1 <= bX2 + CLOSE_THRESHOLD && bX1 <= aX2 + CLOSE_THRESHOLD
}

function verticalSegmentsAreClose(a: Segment, b: Segment): boolean {
  if (!isClose(a.x1, b.x1)) return false
  const aY1 = Math.min(a.y1, a.y2)
  const aY2 = Math.max(a.y1, a.y2)
  const bY1 = Math.min(b.y1, b.y2)
  const bY2 = Math.max(b.y1, b.y2)
  return aY1 <= bY2 + CLOSE_THRESHOLD && bY1 <= aY2 + CLOSE_THRESHOLD
}

function mergeHorizontal(a: Segment, b: Segment): Segment {
  const avgY = (a.y1 + b.y1) / 2
  const allX = [a.x1, a.x2, b.x1, b.x2]
  return {
    ...a,
    x1: Math.min(...allX),
    y1: avgY,
    x2: Math.max(...allX),
    y2: avgY,
  }
}

function mergeVertical(a: Segment, b: Segment): Segment {
  const avgX = (a.x1 + b.x1) / 2
  const allY = [a.y1, a.y2, b.y1, b.y2]
  return {
    ...a,
    x1: avgX,
    y1: Math.min(...allY),
    x2: avgX,
    y2: Math.max(...allY),
  }
}

/**
 * Phase: combineCloseSameNetSegments
 *
 * Merges close/overlapping horizontal and vertical segments that share the same
 * net name. Unlike `combineCloseSameNetTraceSegments` which operates on
 * SchematicTrace edge objects, this function works on flat Segment arrays.
 *
 * Related to issue #29.
 */
export function combineCloseSameNetSegments(segments: Segment[]): Segment[] {
  let current = [...segments]
  let changed = true

  while (changed) {
    changed = false
    const used = new Set<number>()
    const result: Segment[] = []

    for (let i = 0; i < current.length; i++) {
      if (used.has(i)) continue
      let base = current[i]
      const baseIsH = isHorizontal(base)
      const baseIsV = isVertical(base)

      for (let j = i + 1; j < current.length; j++) {
        if (used.has(j)) continue
        const other = current[j]

        // Only merge segments on the same net
        if (base.net_name !== other.net_name) continue

        if (baseIsH && isHorizontal(other) && horizontalSegmentsAreClose(base, other)) {
          base = mergeHorizontal(base, other)
          used.add(j)
          changed = true
        } else if (baseIsV && isVertical(other) && verticalSegmentsAreClose(base, other)) {
          base = mergeVertical(base, other)
          used.add(j)
          changed = true
        }
      }

      result.push(base)
      used.add(i)
    }

    current = result
  }

  return current
}
