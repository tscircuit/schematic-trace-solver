/**
 * TraceMergerSolver
 *
 * Merges same-net schematic trace lines that are very close together on the
 * same axis. Two horizontal segments on the same net are merged when their Y
 * values differ by less than MERGE_THRESHOLD and their X ranges overlap or
 * are adjacent. Vertical segments are treated symmetrically.
 *
 * This eliminates the double-lines visible in dense power-rail schematics
 * (Issue #34).
 */

const MERGE_THRESHOLD = 0.02 // schematic units – tweak if needed

export interface TraceLine {
  x1: number
  y1: number
  x2: number
  y2: number
  netId?: string
}

/**
 * Merge trace lines that share the same net and lie on (nearly) the same
 * horizontal or vertical axis with overlapping / adjacent extents.
 */
export function mergeCloseTraceLines(lines: TraceLine[]): TraceLine[] {
  // Work on a copy so we don't mutate the input
  let remaining = lines.map((l) => normalise(l))
  let changed = true

  while (changed) {
    changed = false
    const merged: TraceLine[] = []
    const used = new Set<number>()

    for (let i = 0; i < remaining.length; i++) {
      if (used.has(i)) continue
      let current = remaining[i]

      for (let j = i + 1; j < remaining.length; j++) {
        if (used.has(j)) continue
        const candidate = remaining[j]

        // Must be same net (undefined nets are treated as compatible)
        if (
          current.netId !== undefined &&
          candidate.netId !== undefined &&
          current.netId !== candidate.netId
        )
          continue

        const result = tryMerge(current, candidate)
        if (result !== null) {
          current = result
          used.add(j)
          changed = true
        }
      }

      merged.push(current)
      used.add(i)
    }

    remaining = merged
  }

  return remaining
}

/**
 * Attempt to merge two segments. Returns the merged segment or null.
 */
function tryMerge(a: TraceLine, b: TraceLine): TraceLine | null {
  const aIsHoriz = isHorizontal(a)
  const bIsHoriz = isHorizontal(b)
  const aIsVert = isVertical(a)
  const bIsVert = isVertical(b)

  // Both horizontal
  if (aIsHoriz && bIsHoriz) {
    if (Math.abs(a.y1 - b.y1) <= MERGE_THRESHOLD) {
      // Check x ranges overlap or are adjacent
      if (rangesOverlap(a.x1, a.x2, b.x1, b.x2)) {
        return {
          x1: Math.min(a.x1, b.x1),
          y1: (a.y1 + b.y1) / 2,
          x2: Math.max(a.x2, b.x2),
          y2: (a.y1 + b.y1) / 2,
          netId: a.netId ?? b.netId,
        }
      }
    }
  }

  // Both vertical
  if (aIsVert && bIsVert) {
    if (Math.abs(a.x1 - b.x1) <= MERGE_THRESHOLD) {
      if (rangesOverlap(a.y1, a.y2, b.y1, b.y2)) {
        return {
          x1: (a.x1 + b.x1) / 2,
          y1: Math.min(a.y1, b.y1),
          x2: (a.x1 + b.x1) / 2,
          y2: Math.max(a.y2, b.y2),
          netId: a.netId ?? b.netId,
        }
      }
    }
  }

  return null
}

/** Ensure x1 <= x2 and y1 <= y2 for easier range maths */
function normalise(l: TraceLine): TraceLine {
  return {
    x1: Math.min(l.x1, l.x2),
    y1: Math.min(l.y1, l.y2),
    x2: Math.max(l.x1, l.x2),
    y2: Math.max(l.y1, l.y2),
    netId: l.netId,
  }
}

function isHorizontal(l: TraceLine) {
  return Math.abs(l.y2 - l.y1) < MERGE_THRESHOLD
}

function isVertical(l: TraceLine) {
  return Math.abs(l.x2 - l.x1) < MERGE_THRESHOLD
}

/** True when [a1,a2] and [b1,b2] overlap or touch */
function rangesOverlap(a1: number, a2: number, b1: number, b2: number) {
  return a1 <= b2 + MERGE_THRESHOLD && b1 <= a2 + MERGE_THRESHOLD
}
