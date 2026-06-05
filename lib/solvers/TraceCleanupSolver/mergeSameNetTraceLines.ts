import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

type Axis = "x" | "y"

interface SegmentRef {
  traceIndex: number
  pointIndex: number
  axis: Axis
  coord: number
  start: number
  end: number
  length: number
}

const EPSILON = 1e-9

function getNetKey(trace: SolvedTracePath): string {
  return trace.globalConnNetId || trace.userNetId || trace.dcConnNetId
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number) {
  return Math.max(a0, b0) <= Math.min(a1, b1) + EPSILON
}

function overlapLength(a0: number, a1: number, b0: number, b1: number) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
}

function hasSubstantialOverlap(a: SegmentRef, b: SegmentRef) {
  const overlap = overlapLength(a.start, a.end, b.start, b.end)
  return overlap >= Math.min(a.length, b.length) * 0.5 - EPSILON
}

function getInteriorOrthogonalSegments(
  trace: SolvedTracePath,
  traceIndex: number,
): SegmentRef[] {
  const segments: SegmentRef[] = []

  for (
    let pointIndex = 1;
    pointIndex < trace.tracePath.length - 2;
    pointIndex++
  ) {
    const p1 = trace.tracePath[pointIndex]!
    const p2 = trace.tracePath[pointIndex + 1]!

    if (Math.abs(p1.y - p2.y) < EPSILON && Math.abs(p1.x - p2.x) > EPSILON) {
      const start = Math.min(p1.x, p2.x)
      const end = Math.max(p1.x, p2.x)
      segments.push({
        traceIndex,
        pointIndex,
        axis: "y",
        coord: p1.y,
        start,
        end,
        length: end - start,
      })
    } else if (
      Math.abs(p1.x - p2.x) < EPSILON &&
      Math.abs(p1.y - p2.y) > EPSILON
    ) {
      const start = Math.min(p1.y, p2.y)
      const end = Math.max(p1.y, p2.y)
      segments.push({
        traceIndex,
        pointIndex,
        axis: "x",
        coord: p1.x,
        start,
        end,
        length: end - start,
      })
    }
  }

  return segments
}

function buildSegmentClusters(
  segments: SegmentRef[],
  maxDistance: number,
): SegmentRef[][] {
  const clusters: SegmentRef[][] = []
  const visited = new Set<number>()

  for (let i = 0; i < segments.length; i++) {
    if (visited.has(i)) continue

    const cluster: SegmentRef[] = []
    const queue = [i]
    visited.add(i)

    while (queue.length > 0) {
      const currentIndex = queue.shift()!
      const current = segments[currentIndex]!
      cluster.push(current)

      for (let nextIndex = 0; nextIndex < segments.length; nextIndex++) {
        if (visited.has(nextIndex)) continue
        const next = segments[nextIndex]!
        if (
          current.axis === next.axis &&
          Math.abs(current.coord - next.coord) <= maxDistance + EPSILON &&
          rangesOverlap(current.start, current.end, next.start, next.end) &&
          hasSubstantialOverlap(current, next)
        ) {
          visited.add(nextIndex)
          queue.push(nextIndex)
        }
      }
    }

    clusters.push(cluster)
  }

  return clusters
}

function getClusterTargetCoord(cluster: SegmentRef[]) {
  return cluster.reduce((best, segment) => {
    if (segment.length !== best.length)
      return segment.length > best.length ? segment : best
    return segment.coord < best.coord ? segment : best
  }).coord
}

function moveSegment(
  points: Point[],
  segment: SegmentRef,
  targetCoord: number,
) {
  const p1 = points[segment.pointIndex]!
  const p2 = points[segment.pointIndex + 1]!

  if (segment.axis === "y") {
    p1.y = targetCoord
    p2.y = targetCoord
  } else {
    p1.x = targetCoord
    p2.x = targetCoord
  }
}

export function mergeSameNetTraceLines({
  traces,
  maxDistance,
}: {
  traces: SolvedTracePath[]
  maxDistance: number
}): SolvedTracePath[] {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  const tracesByNet = new Map<string, number[]>()
  for (const [traceIndex, trace] of outputTraces.entries()) {
    const netKey = getNetKey(trace)
    const traceIndexes = tracesByNet.get(netKey) ?? []
    traceIndexes.push(traceIndex)
    tracesByNet.set(netKey, traceIndexes)
  }

  for (const traceIndexes of tracesByNet.values()) {
    if (traceIndexes.length !== 2) continue

    const segments = traceIndexes.flatMap((traceIndex) =>
      getInteriorOrthogonalSegments(outputTraces[traceIndex]!, traceIndex),
    )
    const clusters = buildSegmentClusters(segments, maxDistance)

    for (const cluster of clusters) {
      if (cluster.length < 2) continue
      const targetCoord = getClusterTargetCoord(cluster)
      for (const segment of cluster) {
        moveSegment(
          outputTraces[segment.traceIndex]!.tracePath,
          segment,
          targetCoord,
        )
      }
    }
  }

  return outputTraces.map((trace) => ({
    ...trace,
    tracePath: simplifyPath(trace.tracePath),
  }))
}
