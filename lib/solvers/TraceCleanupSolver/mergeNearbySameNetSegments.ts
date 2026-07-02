import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

type SegmentOrientation = "horizontal" | "vertical"

interface SegmentInfo {
  id: number
  traceIndex: number
  segmentIndex: number
  globalConnNetId: string
  orientation: SegmentOrientation
  coord: number
  rangeMin: number
  rangeMax: number
}

interface MergeNearbySameNetSegmentsOptions {
  maxDistance?: number
}

const EPS = 1e-6

const getSegmentInfo = (
  trace: SolvedTracePath,
  traceIndex: number,
  segmentIndex: number,
  id: number,
): SegmentInfo | null => {
  const p1 = trace.tracePath[segmentIndex]!
  const p2 = trace.tracePath[segmentIndex + 1]!
  const isHorizontal = Math.abs(p1.y - p2.y) < EPS
  const isVertical = Math.abs(p1.x - p2.x) < EPS

  if (!isHorizontal && !isVertical) return null

  return {
    id,
    traceIndex,
    segmentIndex,
    globalConnNetId: trace.globalConnNetId,
    orientation: isHorizontal ? "horizontal" : "vertical",
    coord: isHorizontal ? p1.y : p1.x,
    rangeMin: isHorizontal ? Math.min(p1.x, p2.x) : Math.min(p1.y, p2.y),
    rangeMax: isHorizontal ? Math.max(p1.x, p2.x) : Math.max(p1.y, p2.y),
  }
}

const rangesOverlap = (a: SegmentInfo, b: SegmentInfo) =>
  Math.min(a.rangeMax, b.rangeMax) - Math.max(a.rangeMin, b.rangeMin) > EPS

const shouldMergeSegments = (
  a: SegmentInfo,
  b: SegmentInfo,
  maxDistance: number,
) =>
  a.traceIndex !== b.traceIndex &&
  a.globalConnNetId === b.globalConnNetId &&
  a.orientation === b.orientation &&
  Math.abs(a.coord - b.coord) <= maxDistance &&
  rangesOverlap(a, b)

const setSegmentCoord = (
  tracePath: Point[],
  segmentIndex: number,
  orientation: SegmentOrientation,
  coord: number,
) => {
  const p1 = tracePath[segmentIndex]!
  const p2 = tracePath[segmentIndex + 1]!

  if (orientation === "horizontal") {
    p1.y = coord
    p2.y = coord
  } else {
    p1.x = coord
    p2.x = coord
  }
}

export const mergeNearbySameNetSegments = (
  traces: SolvedTracePath[],
  options: MergeNearbySameNetSegmentsOptions = {},
): SolvedTracePath[] => {
  const maxDistance = options.maxDistance ?? 0.25
  const mergedTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  const segments: SegmentInfo[] = []
  let nextSegmentId = 0

  for (let traceIndex = 0; traceIndex < mergedTraces.length; traceIndex++) {
    const trace = mergedTraces[traceIndex]!
    for (
      let segmentIndex = 1;
      segmentIndex < trace.tracePath.length - 2;
      segmentIndex++
    ) {
      const segment = getSegmentInfo(
        trace,
        traceIndex,
        segmentIndex,
        nextSegmentId++,
      )
      if (segment) segments.push(segment)
    }
  }

  const adjacency = new Map<number, Set<number>>()
  for (const segment of segments) adjacency.set(segment.id, new Set())

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i]!
      const b = segments[j]!
      if (!shouldMergeSegments(a, b, maxDistance)) continue
      adjacency.get(a.id)!.add(b.id)
      adjacency.get(b.id)!.add(a.id)
    }
  }

  const segmentById = new Map(segments.map((segment) => [segment.id, segment]))
  const visited = new Set<number>()

  for (const segment of segments) {
    if (visited.has(segment.id)) continue

    const component: SegmentInfo[] = []
    const queue = [segment.id]
    visited.add(segment.id)

    while (queue.length > 0) {
      const id = queue.shift()!
      component.push(segmentById.get(id)!)
      for (const nextId of adjacency.get(id)!) {
        if (visited.has(nextId)) continue
        visited.add(nextId)
        queue.push(nextId)
      }
    }

    if (component.length < 2) continue

    component.sort(
      (a, b) => a.traceIndex - b.traceIndex || a.segmentIndex - b.segmentIndex,
    )
    const targetCoord = component[0]!.coord

    for (const item of component) {
      setSegmentCoord(
        mergedTraces[item.traceIndex]!.tracePath,
        item.segmentIndex,
        item.orientation,
        targetCoord,
      )
    }
  }

  return mergedTraces.map((trace) => ({
    ...trace,
    tracePath: simplifyPath(trace.tracePath),
  }))
}
