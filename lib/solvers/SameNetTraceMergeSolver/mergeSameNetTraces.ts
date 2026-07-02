import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/** Two coordinates are considered identical (a segment is axis-aligned) below this. */
const AXIS_EPS = 1e-6

export interface MergeSameNetTracesOptions {
  /**
   * Maximum perpendicular distance between two same-net parallel segments for
   * them to be snapped onto a shared line (so they render as a single trace).
   */
  mergeDistanceThreshold?: number
}

interface AxisSegment {
  traceIndex: number
  /** index of the first point of the segment within the trace path */
  pointIndex: number
  /** the shared (perpendicular) coordinate: y for horizontal, x for vertical */
  coord: number
  /** span of the segment along its own axis */
  lo: number
  hi: number
}

const spanOf = (s: AxisSegment) => s.hi - s.lo

/** [lo, hi] intervals overlap (touching counts). */
const intervalsOverlap = (aLo: number, aHi: number, bLo: number, bHi: number) =>
  aLo <= bHi + AXIS_EPS && bLo <= aHi + AXIS_EPS

/**
 * Collect the axis-aligned segments of a given orientation across a set of
 * traces (indices into `traces`).
 */
const collectSegments = (
  traces: SolvedTracePath[],
  traceIndices: number[],
  orientation: "horizontal" | "vertical",
): AxisSegment[] => {
  const segments: AxisSegment[] = []
  for (const traceIndex of traceIndices) {
    const path = traces[traceIndex]!.tracePath
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]!
      const b = path[i + 1]!
      // Defensively skip segments with non-finite (NaN/Infinity) coordinates.
      if (
        !Number.isFinite(a.x) ||
        !Number.isFinite(a.y) ||
        !Number.isFinite(b.x) ||
        !Number.isFinite(b.y)
      ) {
        continue
      }
      const isHorizontal = Math.abs(a.y - b.y) < AXIS_EPS
      const isVertical = Math.abs(a.x - b.x) < AXIS_EPS
      if (orientation === "horizontal" && isHorizontal && !isVertical) {
        segments.push({
          traceIndex,
          pointIndex: i,
          coord: a.y,
          lo: Math.min(a.x, b.x),
          hi: Math.max(a.x, b.x),
        })
      } else if (orientation === "vertical" && isVertical && !isHorizontal) {
        segments.push({
          traceIndex,
          pointIndex: i,
          coord: a.x,
          lo: Math.min(a.y, b.y),
          hi: Math.max(a.y, b.y),
        })
      }
    }
  }
  return segments
}

/**
 * Group segments into clusters where every member is within `threshold` of, and
 * overlaps (along its axis) with, at least one other member of the cluster.
 * Simple union-find over the pairwise "mergeable" relation.
 */
const clusterSegments = (
  segments: AxisSegment[],
  threshold: number,
): AxisSegment[][] => {
  const parent = segments.map((_, i) => i)
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!
      x = parent[x]!
    }
    return x
  }
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b)
  }

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i]!
      const b = segments[j]!
      const close = Math.abs(a.coord - b.coord) <= threshold
      const overlap = intervalsOverlap(a.lo, a.hi, b.lo, b.hi)
      // Skip pairs that are already on the exact same line — nothing to snap,
      // but they can still chain a cluster together transitively.
      if (close && overlap) union(i, j)
    }
  }

  const clusters = new Map<number, AxisSegment[]>()
  for (let i = 0; i < segments.length; i++) {
    const root = find(i)
    if (!clusters.has(root)) clusters.set(root, [])
    clusters.get(root)!.push(segments[i]!)
  }
  return [...clusters.values()]
}

/** Snap every segment in the cluster onto the coordinate of its longest member. */
const snapCluster = (
  traces: SolvedTracePath[],
  cluster: AxisSegment[],
  orientation: "horizontal" | "vertical",
) => {
  // Choose the dominant (longest) segment's coordinate as the merge target so
  // the most significant trace stays put and shorter stubs move onto it.
  let target = cluster[0]!
  for (const seg of cluster) if (spanOf(seg) > spanOf(target)) target = seg
  const targetCoord = target.coord

  for (const seg of cluster) {
    if (Math.abs(seg.coord - targetCoord) < AXIS_EPS) continue
    const path = traces[seg.traceIndex]!.tracePath
    const p1 = path[seg.pointIndex]!
    const p2 = path[seg.pointIndex + 1]!
    if (orientation === "horizontal") {
      p1.y = targetCoord
      p2.y = targetCoord
    } else {
      p1.x = targetCoord
      p2.x = targetCoord
    }
  }
}

/** Remove zero-length steps and collinear midpoints from a path. */
const simplifyPath = (path: Point[]): Point[] => {
  // Drop consecutive duplicate points.
  const dedup: Point[] = []
  for (const p of path) {
    const last = dedup[dedup.length - 1]
    if (
      !last ||
      Math.abs(last.x - p.x) > AXIS_EPS ||
      Math.abs(last.y - p.y) > AXIS_EPS
    ) {
      dedup.push(p)
    }
  }
  // Drop midpoints that lie on the straight line between their neighbours.
  const out: Point[] = []
  for (let i = 0; i < dedup.length; i++) {
    const prev = out[out.length - 1]
    const cur = dedup[i]!
    const next = dedup[i + 1]
    if (prev && next) {
      const collinearH =
        Math.abs(prev.y - cur.y) < AXIS_EPS &&
        Math.abs(cur.y - next.y) < AXIS_EPS
      const collinearV =
        Math.abs(prev.x - cur.x) < AXIS_EPS &&
        Math.abs(cur.x - next.x) < AXIS_EPS
      if (collinearH || collinearV) continue
    }
    out.push(cur)
  }
  return out
}

/**
 * Pipeline phase logic for issues tscircuit/schematic-trace-solver#29 / #34:
 * combine same-net trace segments that run close together by snapping the
 * shorter ones onto the dominant line (same Y for horizontal, same X for
 * vertical) so they render as a single continuous trace.
 *
 * Traces of different nets are never touched. Returns new trace objects; the
 * input is not mutated.
 */
export const mergeSameNetTraces = (
  traces: SolvedTracePath[],
  options: MergeSameNetTracesOptions = {},
): SolvedTracePath[] => {
  const threshold = options.mergeDistanceThreshold ?? 0.05
  // A non-finite (NaN/Infinity) or non-positive threshold disables merging.
  if (!Number.isFinite(threshold) || threshold <= 0)
    return traces.map((t) => ({ ...t }))

  // Deep-copy the paths so callers' inputs stay untouched.
  const result: SolvedTracePath[] = traces.map((t) => ({
    ...t,
    tracePath: t.tracePath.map((p) => ({ ...p })),
  }))

  // Group trace indices by net.
  const netToTraceIndices = new Map<string, number[]>()
  result.forEach((trace, index) => {
    const net = trace.globalConnNetId
    if (!netToTraceIndices.has(net)) netToTraceIndices.set(net, [])
    netToTraceIndices.get(net)!.push(index)
  })

  for (const traceIndices of netToTraceIndices.values()) {
    if (traceIndices.length === 0) continue

    // Horizontal pass, then re-derive segments for the vertical pass since the
    // horizontal snapping can change vertical segment endpoints.
    for (const orientation of ["horizontal", "vertical"] as const) {
      const segments = collectSegments(result, traceIndices, orientation)
      const clusters = clusterSegments(segments, threshold)
      for (const cluster of clusters) {
        if (cluster.length < 2) continue
        snapCluster(result, cluster, orientation)
      }
    }
  }

  for (const trace of result) {
    trace.tracePath = simplifyPath(trace.tracePath)
  }

  return result
}
