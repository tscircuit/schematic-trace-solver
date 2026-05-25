import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

type Axis = "x" | "y"

interface SegmentRef {
  traceIndex: number
  pointIndex: number
  coord: number
  rangeStart: number
  rangeEnd: number
}

const EPSILON = 1e-9

const getTraceNetKey = (trace: SolvedTracePath) =>
  trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId

const areRangesClose = (
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  threshold: number,
) => Math.max(aStart, bStart) <= Math.min(aEnd, bEnd) + threshold

const getMovableSegments = (
  traces: SolvedTracePath[],
  axis: Axis,
): SegmentRef[] => {
  const segments: SegmentRef[] = []

  for (const [traceIndex, trace] of traces.entries()) {
    for (
      let pointIndex = 0;
      pointIndex < trace.tracePath.length - 1;
      pointIndex++
    ) {
      const start = trace.tracePath[pointIndex]!
      const end = trace.tracePath[pointIndex + 1]!
      const segmentUsesFixedEndpoint =
        pointIndex === 0 || pointIndex + 1 === trace.tracePath.length - 1

      if (segmentUsesFixedEndpoint) continue

      if (axis === "y" && Math.abs(start.y - end.y) < EPSILON) {
        segments.push({
          traceIndex,
          pointIndex,
          coord: start.y,
          rangeStart: Math.min(start.x, end.x),
          rangeEnd: Math.max(start.x, end.x),
        })
      } else if (axis === "x" && Math.abs(start.x - end.x) < EPSILON) {
        segments.push({
          traceIndex,
          pointIndex,
          coord: start.x,
          rangeStart: Math.min(start.y, end.y),
          rangeEnd: Math.max(start.y, end.y),
        })
      }
    }
  }

  return segments
}

const alignSegment = (
  traces: SolvedTracePath[],
  segment: SegmentRef,
  axis: Axis,
  coord: number,
) => {
  const trace = traces[segment.traceIndex]!
  const start = trace.tracePath[segment.pointIndex]!
  const end = trace.tracePath[segment.pointIndex + 1]!

  if (axis === "y") {
    start.y = coord
    end.y = coord
  } else {
    start.x = coord
    end.x = coord
  }
}

const alignAxisSegments = (
  traces: SolvedTracePath[],
  axis: Axis,
  threshold: number,
) => {
  let changed = false
  const segments = getMovableSegments(traces, axis)

  for (let i = 0; i < segments.length; i++) {
    const segmentA = segments[i]!

    for (let j = i + 1; j < segments.length; j++) {
      const segmentB = segments[j]!
      if (segmentA.traceIndex === segmentB.traceIndex) continue
      if (Math.abs(segmentA.coord - segmentB.coord) > threshold) continue
      if (
        !areRangesClose(
          segmentA.rangeStart,
          segmentA.rangeEnd,
          segmentB.rangeStart,
          segmentB.rangeEnd,
          threshold,
        )
      ) {
        continue
      }

      const alignedCoord = (segmentA.coord + segmentB.coord) / 2
      alignSegment(traces, segmentA, axis, alignedCoord)
      alignSegment(traces, segmentB, axis, alignedCoord)
      segmentA.coord = alignedCoord
      segmentB.coord = alignedCoord
      changed = true
    }
  }

  return changed
}

export const alignCloseSameNetTraceSegments = (
  traces: SolvedTracePath[],
  { threshold = 0.15 }: { threshold?: number } = {},
): SolvedTracePath[] => {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))
  const tracesByNet = new Map<string, SolvedTracePath[]>()

  for (const trace of outputTraces) {
    const netKey = getTraceNetKey(trace)
    const group = tracesByNet.get(netKey)
    if (group) {
      group.push(trace)
    } else {
      tracesByNet.set(netKey, [trace])
    }
  }

  for (const sameNetTraces of tracesByNet.values()) {
    if (sameNetTraces.length < 2) continue

    const changedHorizontals = alignAxisSegments(sameNetTraces, "y", threshold)
    const changedVerticals = alignAxisSegments(sameNetTraces, "x", threshold)

    if (changedHorizontals || changedVerticals) {
      for (const trace of sameNetTraces) {
        trace.tracePath = simplifyPath(trace.tracePath)
      }
    }
  }

  return outputTraces
}
