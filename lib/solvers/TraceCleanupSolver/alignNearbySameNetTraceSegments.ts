import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

type Orientation = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  fixedCoord: number
  min: number
  max: number
  length: number
}

export interface SameNetAlignmentOptions {
  maxAlignmentDistance?: number
  maxEndpointGap?: number
  maxIterations?: number
}

const EPS = 1e-6

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  tracePath: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
})

const normalizePath = (path: Point[]): Point[] => {
  const deduped: Point[] = []
  for (const point of path) {
    const previous = deduped[deduped.length - 1]
    if (
      previous &&
      Math.abs(previous.x - point.x) < EPS &&
      Math.abs(previous.y - point.y) < EPS
    ) {
      continue
    }
    deduped.push(point)
  }
  return simplifyPath(deduped)
}

const collectInteriorSegments = (
  traces: SolvedTracePath[],
  traceIndex: number,
): SegmentRef[] => {
  const path = traces[traceIndex]!.tracePath
  const segments: SegmentRef[] = []

  for (let segmentIndex = 1; segmentIndex < path.length - 2; segmentIndex++) {
    const start = path[segmentIndex]!
    const end = path[segmentIndex + 1]!

    if (Math.abs(start.y - end.y) < EPS) {
      const min = Math.min(start.x, end.x)
      const max = Math.max(start.x, end.x)
      if (max - min > EPS) {
        segments.push({
          traceIndex,
          segmentIndex,
          orientation: "horizontal",
          fixedCoord: start.y,
          min,
          max,
          length: max - min,
        })
      }
    } else if (Math.abs(start.x - end.x) < EPS) {
      const min = Math.min(start.y, end.y)
      const max = Math.max(start.y, end.y)
      if (max - min > EPS) {
        segments.push({
          traceIndex,
          segmentIndex,
          orientation: "vertical",
          fixedCoord: start.x,
          min,
          max,
          length: max - min,
        })
      }
    }
  }

  return segments
}

const rangesAreClose = (a: SegmentRef, b: SegmentRef, maxEndpointGap: number) =>
  Math.max(a.min, b.min) - Math.min(a.max, b.max) <= maxEndpointGap

const findNextAlignment = (
  traces: SolvedTracePath[],
  maxAlignmentDistance: number,
  maxEndpointGap: number,
) => {
  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const trace = traces[traceIndex]!
    const sameNetTraces = traces
      .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
      .filter(
        ({ candidate, candidateIndex }) =>
          candidateIndex > traceIndex &&
          candidate.globalConnNetId === trace.globalConnNetId,
      )

    const leftSegments = collectInteriorSegments(traces, traceIndex)
    for (const { candidateIndex } of sameNetTraces) {
      const rightSegments = collectInteriorSegments(traces, candidateIndex)

      for (const left of leftSegments) {
        for (const right of rightSegments) {
          if (left.orientation !== right.orientation) continue
          if (!rangesAreClose(left, right, maxEndpointGap)) continue
          if (
            Math.abs(left.fixedCoord - right.fixedCoord) > maxAlignmentDistance
          ) {
            continue
          }

          const keep = left.length >= right.length ? left : right
          const move = keep === left ? right : left
          if (Math.abs(move.fixedCoord - keep.fixedCoord) < EPS) continue

          return {
            targetCoord: keep.fixedCoord,
            segment: move,
          }
        }
      }
    }
  }

  return null
}

const moveSegmentToCoord = (
  traces: SolvedTracePath[],
  segment: SegmentRef,
  targetCoord: number,
) => {
  const trace = traces[segment.traceIndex]!
  const nextPath = trace.tracePath.map((p) => ({ x: p.x, y: p.y }))
  const start = nextPath[segment.segmentIndex]!
  const end = nextPath[segment.segmentIndex + 1]!

  if (segment.orientation === "horizontal") {
    start.y = targetCoord
    end.y = targetCoord
  } else {
    start.x = targetCoord
    end.x = targetCoord
  }

  traces[segment.traceIndex] = {
    ...trace,
    tracePath: normalizePath(nextPath),
  }
}

export const alignNearbySameNetTraceSegments = (
  traces: SolvedTracePath[],
  {
    maxAlignmentDistance = 0.12,
    maxEndpointGap = 0.05,
    maxIterations = 100,
  }: SameNetAlignmentOptions = {},
) => {
  const outputTraces = traces.map(cloneTrace)
  let changed = false

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const alignment = findNextAlignment(
      outputTraces,
      maxAlignmentDistance,
      maxEndpointGap,
    )
    if (!alignment) break

    moveSegmentToCoord(outputTraces, alignment.segment, alignment.targetCoord)
    changed = true
  }

  return {
    changed,
    traces: outputTraces,
  }
}
