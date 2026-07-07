import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const EPSILON = 1e-9

type SegmentOrientation = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  startIndex: number
  endIndex: number
  netId: string
  orientation: SegmentOrientation
  coordinate: number
  minProjection: number
  maxProjection: number
}

const getSegmentRef = (
  trace: SolvedTracePath,
  traceIndex: number,
  startIndex: number,
): SegmentRef | null => {
  const p1 = trace.tracePath[startIndex]
  const p2 = trace.tracePath[startIndex + 1]

  if (!p1 || !p2 || !trace.globalConnNetId) {
    return null
  }

  if (Math.abs(p1.y - p2.y) <= EPSILON) {
    return {
      traceIndex,
      startIndex,
      endIndex: startIndex + 1,
      netId: trace.globalConnNetId,
      orientation: "horizontal",
      coordinate: p1.y,
      minProjection: Math.min(p1.x, p2.x),
      maxProjection: Math.max(p1.x, p2.x),
    }
  }

  if (Math.abs(p1.x - p2.x) <= EPSILON) {
    return {
      traceIndex,
      startIndex,
      endIndex: startIndex + 1,
      netId: trace.globalConnNetId,
      orientation: "vertical",
      coordinate: p1.x,
      minProjection: Math.min(p1.y, p2.y),
      maxProjection: Math.max(p1.y, p2.y),
    }
  }

  return null
}

const getProjectionGap = (a: SegmentRef, b: SegmentRef): number => {
  if (a.maxProjection < b.minProjection) {
    return b.minProjection - a.maxProjection
  }
  if (b.maxProjection < a.minProjection) {
    return a.minProjection - b.maxProjection
  }
  return 0
}

const alignSegment = (
  path: Point[],
  segment: SegmentRef,
  coordinate: number,
) => {
  const start = path[segment.startIndex]!
  const end = path[segment.endIndex]!

  if (segment.orientation === "horizontal") {
    path[segment.startIndex] = { ...start, y: coordinate }
    path[segment.endIndex] = { ...end, y: coordinate }
  } else {
    path[segment.startIndex] = { ...start, x: coordinate }
    path[segment.endIndex] = { ...end, x: coordinate }
  }
}

const getSegments = (traces: SolvedTracePath[]): SegmentRef[] =>
  traces.flatMap((trace, traceIndex) =>
    trace.tracePath
      .slice(0, -1)
      .map((_, startIndex) => getSegmentRef(trace, traceIndex, startIndex))
      .filter((segment): segment is SegmentRef => segment !== null),
  )

export const mergeSameNetTraceSegments = ({
  traces,
  tolerance,
}: {
  traces: SolvedTracePath[]
  tolerance: number
}): SolvedTracePath[] => {
  const output = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  let changed = true
  let passes = 0

  while (changed && passes < 4) {
    changed = false
    passes++
    const segments = getSegments(output)

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i]!
        const b = segments[j]!

        if (
          a.netId !== b.netId ||
          a.orientation !== b.orientation ||
          a.traceIndex === b.traceIndex
        ) {
          continue
        }

        if (Math.abs(a.coordinate - b.coordinate) > tolerance) {
          continue
        }

        if (getProjectionGap(a, b) > tolerance) {
          continue
        }

        const mergedCoordinate = (a.coordinate + b.coordinate) / 2
        alignSegment(output[a.traceIndex]!.tracePath, a, mergedCoordinate)
        alignSegment(output[b.traceIndex]!.tracePath, b, mergedCoordinate)
        changed = true
      }
    }
  }

  return output.map((trace) => ({
    ...trace,
    tracePath: simplifyPath(trace.tracePath),
  }))
}
