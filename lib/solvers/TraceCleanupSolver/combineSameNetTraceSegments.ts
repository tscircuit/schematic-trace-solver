import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

type SegmentOrientation = "horizontal" | "vertical"

interface TraceSegment {
  traceIndex: number
  startPointIndex: number
  orientation: SegmentOrientation
  fixedCoord: number
  rangeStart: number
  rangeEnd: number
  length: number
}

interface CombineSameNetTraceSegmentsOptions {
  distanceThreshold: number
}

const EPS = 1e-9

const getNetKey = (trace: SolvedTracePath) =>
  trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId

const getOrientation = (
  start: Point,
  end: Point,
): SegmentOrientation | null => {
  if (Math.abs(start.y - end.y) < EPS) return "horizontal"
  if (Math.abs(start.x - end.x) < EPS) return "vertical"
  return null
}

const getRangeDistance = (a: TraceSegment, b: TraceSegment) => {
  if (a.rangeEnd < b.rangeStart) return b.rangeStart - a.rangeEnd
  if (b.rangeEnd < a.rangeStart) return a.rangeStart - b.rangeEnd
  return 0
}

const makeSegments = (traces: SolvedTracePath[]) => {
  const segmentsByNet = new Map<string, TraceSegment[]>()

  traces.forEach((trace, traceIndex) => {
    const netKey = getNetKey(trace)
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const start = trace.tracePath[i]!
      const end = trace.tracePath[i + 1]!
      const orientation = getOrientation(start, end)
      if (!orientation) continue

      const rangeValues =
        orientation === "horizontal" ? [start.x, end.x] : [start.y, end.y]
      const fixedCoord = orientation === "horizontal" ? start.y : start.x
      const rangeStart = Math.min(...rangeValues)
      const rangeEnd = Math.max(...rangeValues)

      if (rangeEnd - rangeStart < EPS) continue

      const segment: TraceSegment = {
        traceIndex,
        startPointIndex: i,
        orientation,
        fixedCoord,
        rangeStart,
        rangeEnd,
        length: rangeEnd - rangeStart,
      }

      const segments = segmentsByNet.get(netKey) ?? []
      segments.push(segment)
      segmentsByNet.set(netKey, segments)
    }
  })

  return segmentsByNet
}

const snapSegment = (
  traces: SolvedTracePath[],
  segment: TraceSegment,
  targetFixedCoord: number,
) => {
  const path = traces[segment.traceIndex]!.tracePath
  const start = path[segment.startPointIndex]!
  const end = path[segment.startPointIndex + 1]!

  if (segment.orientation === "horizontal") {
    start.y = targetFixedCoord
    end.y = targetFixedCoord
  } else {
    start.x = targetFixedCoord
    end.x = targetFixedCoord
  }
}

export const combineSameNetTraceSegments = (
  traces: SolvedTracePath[],
  options: CombineSameNetTraceSegmentsOptions,
): SolvedTracePath[] => {
  const distanceThreshold = Math.max(0, options.distanceThreshold)
  const updatedTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  const segmentsByNet = makeSegments(updatedTraces)

  for (const segments of segmentsByNet.values()) {
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const first = segments[i]!
        const second = segments[j]!

        if (first.traceIndex === second.traceIndex) continue
        if (first.orientation !== second.orientation) continue
        if (
          Math.abs(first.fixedCoord - second.fixedCoord) > distanceThreshold
        ) {
          continue
        }
        if (getRangeDistance(first, second) > distanceThreshold) continue

        const anchor = first.length >= second.length ? first : second
        const segmentToSnap = anchor === first ? second : first
        snapSegment(updatedTraces, segmentToSnap, anchor.fixedCoord)
      }
    }
  }

  return updatedTraces.map((trace) => ({
    ...trace,
    tracePath: simplifyPath(trace.tracePath),
  }))
}
