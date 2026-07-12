import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { simplifyPath } from "./simplifyPath"

type SegmentOrientation = "horizontal" | "vertical"

interface MergeableSegment {
  traceIndex: number
  pointIndex: number
  netKey: string
  orientation: SegmentOrientation
  fixedCoord: number
  minCoord: number
  maxCoord: number
  length: number
}

export interface MergeNearbySameNetTraceSegmentsOptions {
  mergeDistance?: number
}

const DEFAULT_MERGE_DISTANCE = 0.2

const getTraceNetKey = (trace: SolvedTracePath): string =>
  trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId

const getRangeGap = (a: MergeableSegment, b: MergeableSegment): number => {
  if (a.maxCoord < b.minCoord) return b.minCoord - a.maxCoord
  if (b.maxCoord < a.minCoord) return a.minCoord - b.maxCoord
  return 0
}

class UnionFind {
  private parents: number[]

  constructor(size: number) {
    this.parents = Array.from({ length: size }, (_, index) => index)
  }

  find(index: number): number {
    const parent = this.parents[index]!
    if (parent === index) return index
    const root = this.find(parent)
    this.parents[index] = root
    return root
  }

  union(a: number, b: number) {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) this.parents[rootB] = rootA
  }
}

const collectMergeableSegments = (
  traces: SolvedTracePath[],
): MergeableSegment[] => {
  const segments: MergeableSegment[] = []

  traces.forEach((trace, traceIndex) => {
    const netKey = getTraceNetKey(trace)
    for (
      let pointIndex = 0;
      pointIndex < trace.tracePath.length - 1;
      pointIndex++
    ) {
      if (pointIndex === 0 || pointIndex === trace.tracePath.length - 2) {
        continue
      }

      const start = trace.tracePath[pointIndex]!
      const end = trace.tracePath[pointIndex + 1]!
      const orientation: SegmentOrientation | null = isHorizontal(start, end)
        ? "horizontal"
        : isVertical(start, end)
          ? "vertical"
          : null

      if (!orientation) continue

      const fixedCoord = orientation === "horizontal" ? start.y : start.x
      const minCoord =
        orientation === "horizontal"
          ? Math.min(start.x, end.x)
          : Math.min(start.y, end.y)
      const maxCoord =
        orientation === "horizontal"
          ? Math.max(start.x, end.x)
          : Math.max(start.y, end.y)
      const length = maxCoord - minCoord

      if (length === 0) continue

      segments.push({
        traceIndex,
        pointIndex,
        netKey,
        orientation,
        fixedCoord,
        minCoord,
        maxCoord,
        length,
      })
    }
  })

  return segments
}

export const mergeNearbySameNetTraceSegments = (
  traces: SolvedTracePath[],
  opts: MergeNearbySameNetTraceSegmentsOptions = {},
): SolvedTracePath[] => {
  const mergeDistance = opts.mergeDistance ?? DEFAULT_MERGE_DISTANCE
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point): Point => ({ ...point })),
  }))
  const segments = collectMergeableSegments(outputTraces)
  const groups = new UnionFind(segments.length)

  for (let i = 0; i < segments.length; i++) {
    const a = segments[i]!
    for (let j = i + 1; j < segments.length; j++) {
      const b = segments[j]!
      if (a.netKey !== b.netKey) continue
      if (a.orientation !== b.orientation) continue
      if (Math.abs(a.fixedCoord - b.fixedCoord) > mergeDistance) continue
      if (getRangeGap(a, b) > mergeDistance) continue

      groups.union(i, j)
    }
  }

  const clusterMap = new Map<number, MergeableSegment[]>()
  for (let i = 0; i < segments.length; i++) {
    const root = groups.find(i)
    const cluster = clusterMap.get(root)
    if (cluster) {
      cluster.push(segments[i]!)
    } else {
      clusterMap.set(root, [segments[i]!])
    }
  }

  for (const cluster of clusterMap.values()) {
    if (cluster.length < 2) continue

    const totalLength = cluster.reduce(
      (sum, segment) => sum + segment.length,
      0,
    )
    const targetCoord =
      cluster.reduce(
        (sum, segment) => sum + segment.fixedCoord * segment.length,
        0,
      ) / totalLength

    for (const segment of cluster) {
      const trace = outputTraces[segment.traceIndex]!
      const start = trace.tracePath[segment.pointIndex]!
      const end = trace.tracePath[segment.pointIndex + 1]!

      if (segment.orientation === "horizontal") {
        start.y = targetCoord
        end.y = targetCoord
      } else {
        start.x = targetCoord
        end.x = targetCoord
      }
    }
  }

  return outputTraces.map((trace) => ({
    ...trace,
    tracePath: simplifyPath(trace.tracePath),
  }))
}
