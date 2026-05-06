import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

type Orientation = "horizontal" | "vertical"

type SegmentRef = {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  fixedCoord: number
  rangeStart: number
  rangeEnd: number
}

const EPSILON = 1e-6
const DEFAULT_COORDINATE_SNAP_TOLERANCE = 0.08
const DEFAULT_RANGE_GAP_TOLERANCE = 0.12

const rangesTouchOrAreClose = (
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  gapTolerance: number,
): boolean => {
  return !(aEnd < bStart - gapTolerance || bEnd < aStart - gapTolerance)
}

const getNetKey = (trace: SolvedTracePath): string => {
  return trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId
}

const collectSegmentsByNetAndOrientation = (
  traces: SolvedTracePath[],
): Map<string, SegmentRef[]> => {
  const grouped = new Map<string, SegmentRef[]>()

  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const trace = traces[traceIndex]!
    const netKey = getNetKey(trace)
    const path = trace.tracePath
    if (path.length < 2) continue

    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i]!
      const p2 = path[i + 1]!
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y

      if (Math.abs(dx) <= EPSILON && Math.abs(dy) <= EPSILON) continue

      if (Math.abs(dy) <= EPSILON) {
        const key = `${netKey}:horizontal`
        const segments = grouped.get(key) ?? []
        segments.push({
          traceIndex,
          segmentIndex: i,
          orientation: "horizontal",
          fixedCoord: p1.y,
          rangeStart: Math.min(p1.x, p2.x),
          rangeEnd: Math.max(p1.x, p2.x),
        })
        grouped.set(key, segments)
      } else if (Math.abs(dx) <= EPSILON) {
        const key = `${netKey}:vertical`
        const segments = grouped.get(key) ?? []
        segments.push({
          traceIndex,
          segmentIndex: i,
          orientation: "vertical",
          fixedCoord: p1.x,
          rangeStart: Math.min(p1.y, p2.y),
          rangeEnd: Math.max(p1.y, p2.y),
        })
        grouped.set(key, segments)
      }
    }
  }

  return grouped
}

const clusterSegments = (
  segments: SegmentRef[],
  coordinateSnapTolerance: number,
  rangeGapTolerance: number,
): SegmentRef[][] => {
  const sorted = [...segments].sort((a, b) => a.fixedCoord - b.fixedCoord)
  const clusters: SegmentRef[][] = []

  for (const segment of sorted) {
    let attached = false

    for (const cluster of clusters) {
      if (Math.abs(cluster[0]!.fixedCoord - segment.fixedCoord) > coordinateSnapTolerance) {
        continue
      }

      const overlapsCluster = cluster.some((other) =>
        rangesTouchOrAreClose(
          segment.rangeStart,
          segment.rangeEnd,
          other.rangeStart,
          other.rangeEnd,
          rangeGapTolerance,
        ),
      )

      if (!overlapsCluster) continue

      cluster.push(segment)
      attached = true
      break
    }

    if (!attached) clusters.push([segment])
  }

  return clusters
}

const snapCluster = (cluster: SegmentRef[], traces: SolvedTracePath[]) => {
  if (cluster.length < 2) return

  const snappedCoord =
    cluster.reduce((sum, segment) => sum + segment.fixedCoord, 0) / cluster.length

  for (const segment of cluster) {
    const trace = traces[segment.traceIndex]!
    const start = trace.tracePath[segment.segmentIndex]!
    const end = trace.tracePath[segment.segmentIndex + 1]!

    if (segment.orientation === "horizontal") {
      start.y = snappedCoord
      end.y = snappedCoord
    } else {
      start.x = snappedCoord
      end.x = snappedCoord
    }
  }
}

export const mergeSameNetCollinearSegments = (
  traces: SolvedTracePath[],
  opts: {
    coordinateSnapTolerance?: number
    rangeGapTolerance?: number
  } = {},
): SolvedTracePath[] => {
  const coordinateSnapTolerance =
    opts.coordinateSnapTolerance ?? DEFAULT_COORDINATE_SNAP_TOLERANCE
  const rangeGapTolerance =
    opts.rangeGapTolerance ?? DEFAULT_RANGE_GAP_TOLERANCE

  const cloned = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  const grouped = collectSegmentsByNetAndOrientation(cloned)
  for (const segments of grouped.values()) {
    const clusters = clusterSegments(
      segments,
      coordinateSnapTolerance,
      rangeGapTolerance,
    )
    for (const cluster of clusters) {
      snapCluster(cluster, cloned)
    }
  }

  return cloned.map((trace) => ({
    ...trace,
    tracePath: simplifyPath(trace.tracePath),
  }))
}
