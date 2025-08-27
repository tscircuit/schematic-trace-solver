import type { Point } from "@tscircuit/math-utils"
import type { Guideline } from "lib/solvers/GuidelinesSolver/GuidelinesSolver"
import { dir, type FacingDirection } from "lib/utils/dir"

export interface MovableSegment {
  start: Point
  end: Point
  freedom: "x+" | "x-" | "y+" | "y-"
  dir: { x: number; y: number }
}

// ----- constants & small helpers ------------------------------------------------

const EPS = 1e-6 // numeric tolerance for equality
const MIN_LEN = 1e-6 // forbid near-zero length segments (adjacent collapses)

/** True if segment [a,b] is axis-aligned (horizontal or vertical). */
const isAxisAligned = (a: Point, b: Point): boolean =>
  Math.abs(a.x - b.x) < EPS || Math.abs(a.y - b.y) < EPS

/** Returns 'horizontal' | 'vertical' for a valid orth segment, throws otherwise. */
const orientationOf = (a: Point, b: Point): "horizontal" | "vertical" => {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  if (dx < EPS && dy >= EPS) return "vertical"
  if (dy < EPS && dx >= EPS) return "horizontal"
  // Either both ~0 (degenerate) or both non-zero (non-orthogonal).
  throw new Error("Non-orthogonal or degenerate segment detected.")
}

/** Assert the whole polyline is orthogonal and non-degenerate. */
const assertOrthogonalPolyline = (pts: Point[]): void => {
  if (pts.length < 2) {
    throw new Error("Polyline must have at least two points.")
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (!isAxisAligned(a, b)) {
      throw new Error("Polyline contains a non-orthogonal segment.")
    }
    const manhattan = Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
    if (manhattan < MIN_LEN) {
      throw new Error("Polyline contains a near-zero length segment.")
    }
  }
}

type Axis = "x" | "y"

/** Remove near-duplicates and sort numerically (tolerance aware). */
const uniqSortedWithTol = (vals: number[], tol = EPS): number[] => {
  const sorted = vals.slice().sort((a, b) => a - b)
  const out: number[] = []
  for (const v of sorted) {
    if (out.length === 0 || Math.abs(v - out[out.length - 1]) > tol) out.push(v)
  }
  return out
}

/** Stringify a polyline with rounding to dedupe variants robustly. */
const keyForPolyline = (pts: Point[], decimals = 9): string =>
  pts.map((p) => `${p.x.toFixed(decimals)},${p.y.toFixed(decimals)}`).join("|")

/** Collect guideline coordinate candidates for a given movement axis. */
const collectAxisCandidates = (
  axis: Axis,
  guidelines: Guideline[],
  currentCoord: number,
): number[] => {
  const positions: number[] = []
  for (const g of guidelines) {
    if (axis === "x") {
      // moving horizontally: we can snap to vertical guidelines (fixed x)
      if (g.orientation === "vertical" && typeof (g as any).x === "number") {
        positions.push((g as any).x as number)
      }
    } else {
      // moving vertically: we can snap to horizontal guidelines (fixed y)
      if (g.orientation === "horizontal" && typeof (g as any).y === "number") {
        positions.push((g as any).y as number)
      }
    }
  }
  // Include current coordinate to allow "no-move" option.
  positions.push(currentCoord)
  return uniqSortedWithTol(positions)
}

/** Compute the axis and facing direction used for a sliding move. */
const computeFreedom = (
  prev: Point,
  start: Point,
  end: Point,
): { axis: Axis; facing: FacingDirection } => {
  const orient = orientationOf(start, end)
  if (orient === "horizontal") {
    // slide vertically; choose facing away from previous vertex
    const facing: FacingDirection = prev.y <= start.y ? "y+" : "y-"
    return { axis: "y", facing }
  } else {
    // vertical: slide horizontally; choose facing away from previous vertex
    const facing: FacingDirection = prev.x <= start.x ? "x+" : "x-"
    return { axis: "x", facing }
  }
}

/** Safe Cartesian product for small arrays. Returns [[]] for empty input. */
const cartesian = <T>(arrays: T[][]): T[][] =>
  arrays.length === 0
    ? [[]]
    : arrays.reduce<T[][]>(
        (acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])),
        [[]],
      )

// ----- main implementation ------------------------------------------------------

/**
 * Generate strictly-orthogonal elbow variants by sliding strictly interior
 * segments (never adjacent to the first or last segment) perpendicular to
 * their orientation, snapping to guideline coordinates.
 *
 * Guarantees:
 *  - Base polyline must be orthogonal and non-degenerate (throws otherwise).
 *  - Produced variants are orthogonal by construction and validated again.
 *  - Adjacent segments to any moved segment are never collapsed to ~zero length.
 *  - Duplicates are removed (tolerance-aware).
 */
export const generateElbowVariants = ({
  baseElbow,
  guidelines,
}: {
  baseElbow: Point[]
  guidelines: Guideline[]
}): {
  elbowVariants: Array<Point[]>
  movableSegments: Array<MovableSegment>
} => {
  // 1) Validate the input path.
  assertOrthogonalPolyline(baseElbow)

  const nPts = baseElbow.length
  const nSegs = nPts - 1

  // No interior segments to move if path is too short.
  if (nSegs < 5) {
    return {
      elbowVariants: [baseElbow.map((p) => ({ ...p }))],
      movableSegments: [],
    }
  }

  // 2) Choose which segments are allowed to move.
  //    We avoid segments adjacent to the first and last segment:
  //    movable indices i in [2 .. (nPts - 4)] inclusive (segment i connects P[i] -> P[i+1]).
  const firstMovableIndex = 2
  const lastMovableIndex = nPts - 4

  const movableSegments: MovableSegment[] = []
  const movableIdx: number[] = []
  const axes: Axis[] = []
  const optionsPerSegment: number[][] = []

  for (let i = firstMovableIndex; i <= lastMovableIndex; i++) {
    const prev = baseElbow[i - 1]
    const start = baseElbow[i]
    const end = baseElbow[i + 1]
    const next2 = baseElbow[i + 2]

    // Ensure the three segments around this joint are orth and valid.
    // (orientationOf throws if non-orth.)
    const { axis, facing } = computeFreedom(prev, start, end)

    // Build the MovableSegment descriptor (purely informational).
    movableSegments.push({
      start: { ...start },
      end: { ...end },
      freedom: facing,
      dir: dir(facing),
    })
    movableIdx.push(i)
    axes.push(axis)

    // Collect guideline candidates on the move axis and
    // filter out positions that would collapse the adjacent vertical/horizontal segments.
    const currentCoord = axis === "x" ? start.x : start.y
    const rawCandidates = collectAxisCandidates(axis, guidelines, currentCoord)

    const filtered = rawCandidates.filter((pos) => {
      if (axis === "y") {
        // Moving horizontal segment vertically: check neighbors (which are vertical).
        const lenPrev = Math.abs(prev.y - pos)
        const lenNext = Math.abs(next2.y - pos)
        return lenPrev > MIN_LEN && lenNext > MIN_LEN
      } else {
        // Moving vertical segment horizontally: check neighbors (which are horizontal).
        const lenPrev = Math.abs(prev.x - pos)
        const lenNext = Math.abs(next2.x - pos)
        return lenPrev > MIN_LEN && lenNext > MIN_LEN
      }
    })

    // If all candidates would collapse something, keep none (this segment effectively fixed).
    // We still include current position if it was valid (it should be, due to base validation).
    optionsPerSegment.push(filtered)
  }

  // 3) Generate combinations (Cartesian product of positions for each movable segment).
  //    If there are no movable segments or no valid options, this returns [[]],
  //    which yields the base polyline variant only.
  const combos = cartesian(optionsPerSegment)

  // 4) Apply each combination to produce variants, ensure orthogonality, dedupe.
  const seen = new Set<string>()
  const elbowVariants: Point[][] = []

  // Always include the base elbow first.
  {
    const key = keyForPolyline(baseElbow)
    seen.add(key)
    elbowVariants.push(baseElbow.map((p) => ({ ...p })))
  }

  for (const combo of combos) {
    // Skip the "do nothing" combo if it matches the base (we already added it).
    if (combo.length === 0) continue

    const variant = baseElbow.map((p) => ({ ...p }))

    // Slide each selected segment perpendicular to its orientation.
    for (let k = 0; k < movableIdx.length; k++) {
      const segIndex = movableIdx[k] // segment connects [i] -> [i+1]
      const axis = axes[k]
      const newPos = combo[k]

      if (typeof newPos !== "number" || Number.isNaN(newPos)) continue

      if (axis === "y") {
        variant[segIndex] = { ...variant[segIndex], y: newPos }
        variant[segIndex + 1] = { ...variant[segIndex + 1], y: newPos }
      } else {
        variant[segIndex] = { ...variant[segIndex], x: newPos }
        variant[segIndex + 1] = { ...variant[segIndex + 1], x: newPos }
      }
    }

    // Validate (belt-and-suspenders): reject anything non-orth or collapsed.
    try {
      assertOrthogonalPolyline(variant)
    } catch {
      // Should never happen with this construction, but we refuse to emit it.
      continue
    }

    // Dedupe.
    const key = keyForPolyline(variant)
    if (!seen.has(key)) {
      seen.add(key)
      elbowVariants.push(variant)
    }
  }

  return { elbowVariants, movableSegments }
}
