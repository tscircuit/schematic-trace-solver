import type { Bounds, Point } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import { getAnchoredNetLabelRenderedBounds } from "lib/solvers/InlineNetLabelSolver/getAnchoredNetLabelRenderedBounds"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"
import { SCHEMATIC_TRACE_MIN_VISUAL_CENTERLINE_CLEARANCE } from "lib/utils/doesPathCoincideWithTraces"

const EPS = 1e-6
const CLEARANCE = SCHEMATIC_TRACE_MIN_VISUAL_CENTERLINE_CLEARANCE
const DETOUR_MARGIN = 0.1
const MAX_AXIS_COORDINATES = 64
const MAX_CANDIDATES = 8192

interface Params {
  trace: SolvedTracePath
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  labels: NetLabelPlacement[]
}

const pad = (bounds: Bounds, amount: number): Bounds => ({
  minX: bounds.minX - amount,
  maxX: bounds.maxX + amount,
  minY: bounds.minY - amount,
  maxY: bounds.maxY + amount,
})
const segmentBounds = (a: Point, b: Point): Bounds => ({
  minX: Math.min(a.x, b.x),
  maxX: Math.max(a.x, b.x),
  minY: Math.min(a.y, b.y),
  maxY: Math.max(a.y, b.y),
})
const samePoint = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS
const direction = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPS
    ? b.y > a.y
      ? "y+"
      : "y-"
    : b.x > a.x
      ? "x+"
      : "x-"
const segments = (path: Point[]): [Point, Point][] =>
  path.slice(1).map((point, i) => [path[i]!, point])
const pathLength = (path: Point[]) =>
  segments(path).reduce(
    (sum, [a, b]) => sum + Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
    0,
  )

// A label already attached to this rail may intentionally touch its old stem.
// Preserve that exact attachment geometry, never grant a blanket same-net
// exemption for a new route through the label body or its drawing clearance.
const overlapFollowsOriginalPath = (
  a: Point,
  b: Point,
  bounds: Bounds,
  original: Point[],
) => {
  const vertical = Math.abs(a.x - b.x) < EPS
  const low = vertical
    ? Math.max(Math.min(a.y, b.y), bounds.minY)
    : Math.max(Math.min(a.x, b.x), bounds.minX)
  const high = vertical
    ? Math.min(Math.max(a.y, b.y), bounds.maxY)
    : Math.min(Math.max(a.x, b.x), bounds.maxX)
  const start = vertical ? { x: a.x, y: low } : { x: low, y: a.y }
  const end = vertical ? { x: a.x, y: high } : { x: high, y: a.y }
  return segments(original).some(
    ([p, q]) =>
      tracePathContainsPoint([p, q], start) &&
      tracePathContainsPoint([p, q], end),
  )
}

/**
 * A bounded fallback for late label detours blocked by nearby components.
 * Normal candidates only pivot around the label's own rectangle. Enumerate
 * a few longer orthogonal detours using actual obstacle edges, reconnecting
 * farther along the original path when its immediate elbow is blocked.
 * Returning null leaves the original, connected route untouched.
 */
export const findObstacleAwareDetour = ({
  trace,
  inputProblem,
  traces,
  labels,
}: Params): Point[] | null => {
  const original = simplifyPath(trace.tracePath)
  if (original.length < 2 || original.length > 12) return null
  if (original.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
    return null
  if (
    segments(original).some(
      ([a, b]) => Math.abs(a.x - b.x) > EPS && Math.abs(a.y - b.y) > EPS,
    )
  )
    return null
  const first = original[0]!
  const last = original.at(-1)!
  const obstacles = getObstacleRects(inputProblem)
  const labelObstacles = labels.map((label) => ({
    label,
    bounds: getAnchoredNetLabelRenderedBounds(label),
    attached:
      label.globalConnNetId === trace.globalConnNetId &&
      tracePathContainsPoint(original, label.anchorPoint),
  }))
  const otherNetSegments = traces
    .filter((other) => other.globalConnNetId !== trace.globalConnNetId)
    .flatMap((other) => segments(other.tracePath))
  const otherNetBounds = otherNetSegments.map(([a, b]) => segmentBounds(a, b))
  const requiredPoints = [
    ...trace.pins,
    ...labelObstacles.filter((o) => o.attached).map((o) => o.label.anchorPoint),
  ]
  // Preserve T-junctions, perpendicular meetings and the ends of coincident
  // spans, even if a same-net branch was generated after the original route.
  for (const other of traces) {
    if (
      other.mspPairId === trace.mspPairId ||
      other.globalConnNetId !== trace.globalConnNetId
    )
      continue
    requiredPoints.push(
      ...other.tracePath.filter((point) =>
        tracePathContainsPoint(original, point),
      ),
    )
    requiredPoints.push(
      ...original.filter((point) =>
        tracePathContainsPoint(other.tracePath, point),
      ),
    )
    for (const [a, b] of segments(original))
      for (const [c, d] of segments(other.tracePath)) {
        const point = getSegmentIntersection(a, b, c, d)
        if (point) requiredPoints.push(point)
      }
  }
  // Do not attempt to repair a route that already lost an owned pin.
  if (requiredPoints.some((point) => !tracePathContainsPoint(original, point)))
    return null

  const foreignLabels = labelObstacles.filter(
    (o) => o.label.globalConnNetId !== trace.globalConnNetId,
  )
  const blockedPortLabels = foreignLabels.filter(
    (o) =>
      o.label.mspConnectionPairIds.length === 0 &&
      segments(original).some(([a, b]) =>
        segmentIntersectsRect(a, b, o.bounds),
      ),
  )
  // This fallback handles dense adjacent port labels. Leave isolated-label
  // and routed-label policies to the established solvers.
  if (blockedPortLabels.length < 2) return null
  const collidingSegments = segments(original).flatMap(([a, b], index) =>
    foreignLabels.some((o) => segmentIntersectsRect(a, b, o.bounds))
      ? [index]
      : [],
  )
  if (collidingSegments.length === 0) return null
  const firstCollision = collidingSegments[0]!
  const lastCollision = collidingSegments.at(-1)!
  const allBounds = [
    ...obstacles,
    ...labelObstacles.map((o) => o.bounds),
    ...otherNetBounds,
  ]
  const bounds = segmentBounds(first, last)
  const coordinateCandidates = (axis: "x" | "y") => {
    const min = axis === "x" ? "minX" : "minY"
    const max = axis === "x" ? "maxX" : "maxY"
    const values = [
      ...original.map((p) => p[axis]),
      ...allBounds.flatMap((b) => [
        b[min] - DETOUR_MARGIN,
        b[max] + DETOUR_MARGIN,
      ]),
    ]
    const distance = (v: number) =>
      Math.max(bounds[min] - v, 0, v - bounds[max])
    return [...new Set(values.map((v) => Math.round(v * 1e6) / 1e6))]
      .sort((a, b) => distance(a) - distance(b) || a - b)
      .slice(0, MAX_AXIS_COORDINATES)
  }
  const xs = coordinateCandidates("x")
  const ys = coordinateCandidates("y")
  const paddedObstacles = obstacles.map((o) => ({
    original: o,
    bounds: pad(o, CLEARANCE),
  }))
  const paddedLabels = labelObstacles.map((o) => ({
    ...o,
    bounds: pad(o.bounds, CLEARANCE),
  }))
  const paddedOtherNetBounds = otherNetBounds.map((b) => pad(b, CLEARANCE))
  const valid = (path: Point[]) => {
    if (!samePoint(path[0]!, first) || !samePoint(path.at(-1)!, last))
      return false
    if (
      direction(path[0]!, path[1]!) !== direction(first, original[1]!) ||
      direction(path.at(-2)!, last) !== direction(original.at(-2)!, last)
    )
      return false
    if (requiredPoints.some((point) => !tracePathContainsPoint(path, point)))
      return false
    const parts = segments(path)
    for (const [index, [a, b]] of parts.entries()) {
      if (
        samePoint(a, b) ||
        (Math.abs(a.x - b.x) > EPS && Math.abs(a.y - b.y) > EPS)
      )
        return false
      for (const obstacle of paddedObstacles) {
        if (segmentIntersectsRect(a, b, obstacle.original)) return false
        if (!segmentIntersectsRect(a, b, obstacle.bounds)) continue
        // Only a pin's outward terminal segment can traverse its own chip's
        // clearance. Chip interiors and every other segment remain blocked.
        const chipId =
          obstacle.original.kind === "chip" ? obstacle.original.chipId : null
        const terminal =
          index === 0 ? first : index === parts.length - 1 ? last : null
        if (
          !terminal ||
          obstacle.original.kind !== "chip" ||
          !trace.pins.some(
            (pin) => pin.chipId === chipId && samePoint(pin, terminal),
          )
        )
          return false
      }
      if (
        paddedOtherNetBounds.some((bounds) =>
          segmentIntersectsRect(a, b, bounds),
        )
      )
        return false
      for (const obstacle of paddedLabels) {
        if (!segmentIntersectsRect(a, b, obstacle.bounds)) continue
        if (
          !obstacle.attached ||
          !overlapFollowsOriginalPath(a, b, obstacle.bounds, original)
        )
          return false
      }
      // No loops, self-contacts or non-adjacent overlapping segments.
      for (const [c, d] of parts.slice(index + 2)) {
        if (
          getSegmentIntersection(a, b, c, d) ||
          tracePathContainsPoint([a, b], c) ||
          tracePathContainsPoint([a, b], d)
        )
          return false
      }
    }
    return true
  }

  let best: Point[] | null = null
  let bestLength = Infinity
  let attempted = 0
  const seen = new Set<string>()
  // Preserve the nearest original entry first; reconnecting later can escape
  // a blocking component without moving an attached rail label at that entry.
  for (
    let entryIndex = firstCollision;
    entryIndex >= Math.max(0, firstCollision - 3);
    entryIndex--
  ) {
    for (
      let exitIndex = original.length - 1;
      exitIndex >= lastCollision + 1;
      exitIndex--
    ) {
      const entry = original[entryIndex]!
      const exit = original[exitIndex]!
      for (const x of xs)
        for (const y of ys) {
          for (const detour of [
            [entry, { x: entry.x, y }, { x, y }, { x, y: exit.y }, exit],
            [entry, { x, y: entry.y }, { x, y }, { x: exit.x, y }, exit],
          ]) {
            const path = simplifyPath([
              ...original.slice(0, entryIndex),
              ...detour,
              ...original.slice(exitIndex + 1),
            ])
            const key = path.map((p) => `${p.x},${p.y}`).join(";")
            if (seen.has(key)) continue
            seen.add(key)
            if (++attempted > MAX_CANDIDATES) return best
            const length = pathLength(path)
            if (
              length > bestLength + EPS ||
              (Math.abs(length - bestLength) < EPS &&
                best &&
                path.length >= best.length)
            )
              continue
            if (!valid(path)) continue
            best = path
            bestLength = length
          }
        }
    }
  }
  return best
}
