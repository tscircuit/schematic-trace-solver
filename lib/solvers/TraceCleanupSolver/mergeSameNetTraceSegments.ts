import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

type SegmentOrientation = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  segmentIndex: number
  orientation: SegmentOrientation
  coord: number
  min: number
  max: number
  length: number
}

const EPS = 1e-6

const getSegmentRef = (
  trace: SolvedTracePath,
  traceIndex: number,
  segmentIndex: number,
): SegmentRef | null => {
  const p1 = trace.tracePath[segmentIndex]!
  const p2 = trace.tracePath[segmentIndex + 1]!

  if (Math.abs(p1.y - p2.y) < EPS) {
    return {
      traceIndex,
      segmentIndex,
      orientation: "horizontal",
      coord: p1.y,
      min: Math.min(p1.x, p2.x),
      max: Math.max(p1.x, p2.x),
      length: Math.abs(p1.x - p2.x),
    }
  }

  if (Math.abs(p1.x - p2.x) < EPS) {
    return {
      traceIndex,
      segmentIndex,
      orientation: "vertical",
      coord: p1.x,
      min: Math.min(p1.y, p2.y),
      max: Math.max(p1.y, p2.y),
      length: Math.abs(p1.y - p2.y),
    }
  }

  return null
}

const hasProjectionOverlap = (a: SegmentRef, b: SegmentRef): boolean => {
  return Math.min(a.max, b.max) - Math.max(a.min, b.min) > EPS
}

const isInternalSegment = (
  trace: SolvedTracePath,
  segmentIndex: number,
): boolean => {
  return segmentIndex > 0 && segmentIndex < trace.tracePath.length - 2
}

const shiftedTrace = (
  trace: SolvedTracePath,
  segmentIndex: number,
  orientation: SegmentOrientation,
  coord: number,
): SolvedTracePath => {
  const tracePath = trace.tracePath.map((point) => ({ ...point }))
  const p1 = tracePath[segmentIndex]!
  const p2 = tracePath[segmentIndex + 1]!

  if (orientation === "horizontal") {
    tracePath[segmentIndex] = { x: p1.x, y: coord }
    tracePath[segmentIndex + 1] = { x: p2.x, y: coord }
  } else {
    tracePath[segmentIndex] = { x: coord, y: p1.y }
    tracePath[segmentIndex + 1] = { x: coord, y: p2.y }
  }

  return { ...trace, tracePath: simplifyPath(tracePath as Point[]) }
}

export const mergeSameNetTraceSegments = (
  traces: SolvedTracePath[],
  maxDistance = 0.1,
): SolvedTracePath[] => {
  let nextTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  for (let pass = 0; pass < 8; pass++) {
    let didMerge = false

    for (let traceIndex = 0; traceIndex < nextTraces.length; traceIndex++) {
      const trace = nextTraces[traceIndex]!

      for (
        let segmentIndex = 1;
        segmentIndex < trace.tracePath.length - 2;
        segmentIndex++
      ) {
        const target = getSegmentRef(trace, traceIndex, segmentIndex)
        if (!target || !isInternalSegment(trace, segmentIndex)) continue

        let bestRef: SegmentRef | null = null
        for (
          let otherTraceIndex = 0;
          otherTraceIndex < nextTraces.length;
          otherTraceIndex++
        ) {
          if (otherTraceIndex === traceIndex) continue
          const otherTrace = nextTraces[otherTraceIndex]!
          if (otherTrace.globalConnNetId !== trace.globalConnNetId) continue

          for (
            let otherSegmentIndex = 0;
            otherSegmentIndex < otherTrace.tracePath.length - 1;
            otherSegmentIndex++
          ) {
            const candidate = getSegmentRef(
              otherTrace,
              otherTraceIndex,
              otherSegmentIndex,
            )
            if (!candidate) continue
            if (candidate.orientation !== target.orientation) continue
            if (candidate.length <= target.length) continue
            if (!hasProjectionOverlap(target, candidate)) continue
            if (Math.abs(candidate.coord - target.coord) > maxDistance) continue

            if (!bestRef || candidate.length > bestRef.length) {
              bestRef = candidate
            }
          }
        }

        if (bestRef && Math.abs(bestRef.coord - target.coord) > EPS) {
          nextTraces[traceIndex] = shiftedTrace(
            trace,
            segmentIndex,
            target.orientation,
            bestRef.coord,
          )
          didMerge = true
        }
      }
    }

    if (!didMerge) break
  }

  return nextTraces
}
