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

const checkIfUTurnNeeded = (elbow: Point[]): boolean => {
  if (elbow.length !== 4) return false

  const [start, p1, p2, end] = elbow

  // Determine facing directions from the path segments
  const startOrient = orientationOf(start, p1)
  const startFacing: FacingDirection =
    startOrient === "horizontal"
      ? p1.x > start.x
        ? "x+"
        : "x-"
      : p1.y > start.y
        ? "y+"
        : "y-"

  const endOrient = orientationOf(p2, end)
  const endFacing: FacingDirection =
    endOrient === "horizontal"
      ? end.x > p2.x
        ? "x+"
        : "x-"
      : end.y > p2.y
        ? "y+"
        : "y-"

  // Check if path overshoots and needs to turn back
  if (startFacing === "x+" && end.x < p1.x - EPS) return true
  if (startFacing === "x-" && end.x > p1.x + EPS) return true
  if (startFacing === "y+" && end.y < p1.y - EPS) return true
  if (startFacing === "y-" && end.y > p1.y + EPS) return true

  // Check if path segments conflict (p2 is past the end in the facing direction)
  if (endFacing === "x-" && p2.x > end.x + EPS && startFacing === "x+")
    return true
  if (endFacing === "x+" && p2.x < end.x - EPS && startFacing === "x-")
    return true
  if (endFacing === "y-" && p2.y > end.y + EPS && startFacing === "y+")
    return true
  if (endFacing === "y+" && p2.y < end.y - EPS && startFacing === "y-")
    return true

  return false
}

const expandToUTurn = (elbow: Point[]): Point[] => {
  if (elbow.length !== 4) return elbow

  const [start, p1, p2, end] = elbow

  // Calculate overshoot distance from existing segments
  const overshoot = Math.max(
    Math.abs(start.x - p1.x),
    Math.abs(start.y - p1.y),
    0.2, // minimum overshoot
  )

  const startOrient = orientationOf(start, p1)
  const expanded: Point[] = [{ ...start }]

  if (startOrient === "horizontal") {
    const startDir = p1.x > start.x ? 1 : -1
    expanded.push({ x: start.x + startDir * overshoot, y: start.y })

    // Move away vertically to create space for U-turn
    const verticalSpace = Math.max(
      overshoot * 2,
      Math.abs(end.y - start.y) + overshoot,
    )
    const midY =
      end.y > start.y ? start.y - verticalSpace : start.y + verticalSpace

    expanded.push({ x: start.x + startDir * overshoot, y: midY })

    // Approach end from its required direction
    const endOrient = orientationOf(p2, end)
    const endApproachX =
      endOrient === "horizontal"
        ? end.x > p2.x
          ? end.x - overshoot
          : end.x + overshoot
        : end.x

    expanded.push({ x: endApproachX, y: midY })
    expanded.push({ x: endApproachX, y: end.y })
  } else {
    // Vertical start
    const startDir = p1.y > start.y ? 1 : -1
    expanded.push({ x: start.x, y: start.y + startDir * overshoot })

    // Move away horizontally to create space for U-turn
    const horizontalSpace = Math.max(
      overshoot * 2,
      Math.abs(end.x - start.x) + overshoot,
    )
    const midX =
      end.x > start.x ? start.x - horizontalSpace : start.x + horizontalSpace

    expanded.push({ x: midX, y: start.y + startDir * overshoot })

    // Approach end from its required direction
    const endOrient = orientationOf(p2, end)
    const endApproachY =
      endOrient === "vertical"
        ? end.y > p2.y
          ? end.y - overshoot
          : end.y + overshoot
        : end.y

    expanded.push({ x: midX, y: endApproachY })
    expanded.push({ x: end.x, y: endApproachY })
  }

  expanded.push({ ...end })
  return expanded
}

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

/** Remove consecutive duplicate points (within tolerance) to eliminate zero-length segments. */
const preprocessElbow = (pts: Point[], tol = MIN_LEN): Point[] => {
  if (pts.length === 0) return []
  const out: Point[] = [{ ...pts[0] }]
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]
    const last = out[out.length - 1]
    const manhattan = Math.abs(p.x - last.x) + Math.abs(p.y - last.y)
    if (manhattan > tol) out.push({ ...p })
  }
  return out
}

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
  // 1) Preprocess to remove zero-length segments, then validate the input path.
  const elbow = preprocessElbow(baseElbow)
  assertOrthogonalPolyline(elbow)

  const nPts = elbow.length

  // No interior segments to move if path is too short.
  if (nPts < 4) {
    return {
      elbowVariants: [elbow.map((p) => ({ ...p }))],
      movableSegments: [],
    }
  } else if (nPts === 4) {
    const needsUTurn = checkIfUTurnNeeded(elbow)
    if (needsUTurn) {
      const expandedElbow = expandToUTurn(elbow)
      // Recursively call with the expanded path
      return generateElbowVariants({ baseElbow: expandedElbow, guidelines })
    }
  }

  // 2) Choose which segments are allowed to move.
  //    We avoid moving the very first and last segments of the:
  //    movable indices i in [1 .. (nPts - 3)] inclusive (segment i connects P[i] -> P[i+1]).
  const firstMovableIndex = 1
  const lastMovableIndex = nPts - 3

  const movableSegments: MovableSegment[] = []
  const movableIdx: number[] = []
  const axes: Axis[] = []
  const optionsPerSegment: number[][] = []

  for (let i = firstMovableIndex; i <= lastMovableIndex; i++) {
    const prev = elbow[i - 1]
    const start = elbow[i]
    const end = elbow[i + 1]
    const next2 = elbow[i + 2]

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
    const key = keyForPolyline(elbow)
    seen.add(key)
    elbowVariants.push(elbow.map((p) => ({ ...p })))
  }

  for (const combo of combos) {
    // Skip the "do nothing" combo if it matches the base (we already added it).
    if (combo.length === 0) continue

    const variant = elbow.map((p) => ({ ...p }))

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
