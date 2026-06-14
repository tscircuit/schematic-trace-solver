import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-6
const DEFAULT_ALIGNMENT_THRESHOLD = 0.2

type Orientation = "horizontal" | "vertical"

type SegmentRef = {
  traceId: string
  segmentIndex: number
  orientation: Orientation
  axis: number
  min: number
  max: number
}

const rangesOverlap = (a: SegmentRef, b: SegmentRef) =>
  Math.min(a.max, b.max) - Math.max(a.min, b.min) > EPS

const samePoint = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

const getSegments = (traces: SolvedTracePath[]): SegmentRef[] => {
  const segments: SegmentRef[] = []

  for (const trace of traces) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const p1 = trace.tracePath[i]!
      const p2 = trace.tracePath[i + 1]!
      const isHorizontal = Math.abs(p1.y - p2.y) < EPS
      const isVertical = Math.abs(p1.x - p2.x) < EPS

      if (!isHorizontal && !isVertical) continue

      segments.push({
        traceId: trace.mspPairId,
        segmentIndex: i,
        orientation: isHorizontal ? "horizontal" : "vertical",
        axis: isHorizontal ? p1.y : p1.x,
        min: isHorizontal ? Math.min(p1.x, p2.x) : Math.min(p1.y, p2.y),
        max: isHorizontal ? Math.max(p1.x, p2.x) : Math.max(p1.y, p2.y),
      })
    }
  }

  return segments
}

const alignSegment = (
  trace: SolvedTracePath,
  segment: SegmentRef,
  axis: number,
) => {
  const originalPath = trace.tracePath
  const p1 = originalPath[segment.segmentIndex]!
  const p2 = originalPath[segment.segmentIndex + 1]!

  const alignedStart =
    segment.orientation === "horizontal"
      ? { x: p1.x, y: axis }
      : { x: axis, y: p1.y }
  const alignedEnd =
    segment.orientation === "horizontal"
      ? { x: p2.x, y: axis }
      : { x: axis, y: p2.y }

  const replacement = [{ ...p1 }]
  if (!samePoint(p1, alignedStart)) replacement.push(alignedStart)
  if (!samePoint(alignedStart, alignedEnd)) replacement.push(alignedEnd)
  if (!samePoint(alignedEnd, p2)) replacement.push({ ...p2 })

  const tracePath = [
    ...originalPath.slice(0, segment.segmentIndex).map((point) => ({
      ...point,
    })),
    ...replacement,
    ...originalPath.slice(segment.segmentIndex + 2).map((point) => ({
      ...point,
    })),
  ]

  if (tracePath.length < 2) {
    return trace
  }

  return {
    ...trace,
    tracePath: simplifyPath(tracePath),
  }
}

export const alignNearbySameNetSegments = (
  traces: SolvedTracePath[],
  threshold = DEFAULT_ALIGNMENT_THRESHOLD,
): SolvedTracePath[] => {
  const outputMap = new Map(traces.map((trace) => [trace.mspPairId, trace]))
  const tracesByNet = new Map<string, SolvedTracePath[]>()

  for (const trace of traces) {
    const netTraces = tracesByNet.get(trace.globalConnNetId)
    if (netTraces) {
      netTraces.push(trace)
    } else {
      tracesByNet.set(trace.globalConnNetId, [trace])
    }
  }

  for (const netTraces of tracesByNet.values()) {
    const segments = getSegments(netTraces)

    for (let i = 0; i < segments.length; i++) {
      const a = segments[i]!

      for (let j = i + 1; j < segments.length; j++) {
        const b = segments[j]!
        if (a.traceId === b.traceId) continue
        if (a.orientation !== b.orientation) continue
        if (!rangesOverlap(a, b)) continue
        if (Math.abs(a.axis - b.axis) > threshold) continue

        const targetAxis = (a.axis + b.axis) / 2
        const traceA = outputMap.get(a.traceId)!
        const traceB = outputMap.get(b.traceId)!

        outputMap.set(a.traceId, alignSegment(traceA, a, targetAxis))
        outputMap.set(b.traceId, alignSegment(traceB, b, targetAxis))
      }
    }
  }

  return traces.map((trace) => outputMap.get(trace.mspPairId)!)
}
