import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-6
const DEFAULT_MERGE_DISTANCE = 0.12

type Segment = {
  traceIndex: number
  segmentIndex: number
  p1: Point
  p2: Point
  orientation: "horizontal" | "vertical"
  fixedCoord: number
  minRange: number
  maxRange: number
}

const getSegment = (
  trace: SolvedTracePath,
  traceIndex: number,
  segmentIndex: number,
): Segment | null => {
  const p1 = trace.tracePath[segmentIndex]!
  const p2 = trace.tracePath[segmentIndex + 1]!

  if (Math.abs(p1.y - p2.y) < EPS) {
    return {
      traceIndex,
      segmentIndex,
      p1,
      p2,
      orientation: "horizontal",
      fixedCoord: p1.y,
      minRange: Math.min(p1.x, p2.x),
      maxRange: Math.max(p1.x, p2.x),
    }
  }

  if (Math.abs(p1.x - p2.x) < EPS) {
    return {
      traceIndex,
      segmentIndex,
      p1,
      p2,
      orientation: "vertical",
      fixedCoord: p1.x,
      minRange: Math.min(p1.y, p2.y),
      maxRange: Math.max(p1.y, p2.y),
    }
  }

  return null
}

const rangesOverlap = (a: Segment, b: Segment) =>
  Math.min(a.maxRange, b.maxRange) - Math.max(a.minRange, b.minRange) > EPS

const sameNet = (a: SolvedTracePath, b: SolvedTracePath) =>
  a.globalConnNetId === b.globalConnNetId

const setSegmentFixedCoord = (
  path: Point[],
  segmentIndex: number,
  orientation: Segment["orientation"],
  coord: number,
) => {
  if (orientation === "horizontal") {
    path[segmentIndex] = { ...path[segmentIndex]!, y: coord }
    path[segmentIndex + 1] = { ...path[segmentIndex + 1]!, y: coord }
  } else {
    path[segmentIndex] = { ...path[segmentIndex]!, x: coord }
    path[segmentIndex + 1] = { ...path[segmentIndex + 1]!, x: coord }
  }
}

const isInternalSegment = (trace: SolvedTracePath, segmentIndex: number) =>
  segmentIndex > 0 && segmentIndex < trace.tracePath.length - 2

export const mergeCloseSameNetTraceSegments = (
  traces: SolvedTracePath[],
  mergeDistance = DEFAULT_MERGE_DISTANCE,
): SolvedTracePath[] => {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  for (let traceAIndex = 0; traceAIndex < outputTraces.length; traceAIndex++) {
    const traceA = outputTraces[traceAIndex]!

    for (
      let segAIndex = 0;
      segAIndex < traceA.tracePath.length - 1;
      segAIndex++
    ) {
      const segmentA = getSegment(traceA, traceAIndex, segAIndex)
      if (!segmentA) continue

      for (
        let traceBIndex = traceAIndex + 1;
        traceBIndex < outputTraces.length;
        traceBIndex++
      ) {
        const traceB = outputTraces[traceBIndex]!
        if (!sameNet(traceA, traceB)) continue

        for (
          let segBIndex = 0;
          segBIndex < traceB.tracePath.length - 1;
          segBIndex++
        ) {
          if (!isInternalSegment(traceB, segBIndex)) continue

          const segmentB = getSegment(traceB, traceBIndex, segBIndex)
          if (!segmentB) continue
          if (segmentA.orientation !== segmentB.orientation) continue
          if (!rangesOverlap(segmentA, segmentB)) continue

          const distance = Math.abs(segmentA.fixedCoord - segmentB.fixedCoord)
          if (distance < EPS || distance > mergeDistance) continue

          setSegmentFixedCoord(
            traceB.tracePath,
            segmentB.segmentIndex,
            segmentB.orientation,
            segmentA.fixedCoord,
          )
        }
      }
    }
  }

  return outputTraces.map((trace) => ({
    ...trace,
    tracePath: simplifyPath(trace.tracePath),
  }))
}
