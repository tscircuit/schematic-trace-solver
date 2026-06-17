import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const DEFAULT_MERGE_DISTANCE = 0.1
const EPSILON = 1e-9

type SegmentRef = {
  traceIndex: number
  pointIndex: number
  globalConnNetId: string
  orientation: "horizontal" | "vertical"
  fixedCoord: number
  minCoord: number
  maxCoord: number
  length: number
  movable: boolean
}

const nearlyEqual = (a: number, b: number) => Math.abs(a - b) <= EPSILON

const getSegments = (traces: SolvedTracePath[]): SegmentRef[] => {
  const segments: SegmentRef[] = []

  for (const [traceIndex, trace] of traces.entries()) {
    for (
      let pointIndex = 0;
      pointIndex < trace.tracePath.length - 1;
      pointIndex++
    ) {
      const start = trace.tracePath[pointIndex]!
      const end = trace.tracePath[pointIndex + 1]!

      if (nearlyEqual(start.y, end.y)) {
        segments.push({
          traceIndex,
          pointIndex,
          globalConnNetId: trace.globalConnNetId,
          orientation: "horizontal",
          fixedCoord: start.y,
          minCoord: Math.min(start.x, end.x),
          maxCoord: Math.max(start.x, end.x),
          length: Math.abs(end.x - start.x),
          movable:
            pointIndex > 0 && pointIndex + 1 < trace.tracePath.length - 1,
        })
      } else if (nearlyEqual(start.x, end.x)) {
        segments.push({
          traceIndex,
          pointIndex,
          globalConnNetId: trace.globalConnNetId,
          orientation: "vertical",
          fixedCoord: start.x,
          minCoord: Math.min(start.y, end.y),
          maxCoord: Math.max(start.y, end.y),
          length: Math.abs(end.y - start.y),
          movable:
            pointIndex > 0 && pointIndex + 1 < trace.tracePath.length - 1,
        })
      }
    }
  }

  return segments
}

const projectionsOverlap = (a: SegmentRef, b: SegmentRef) => {
  const overlap =
    Math.min(a.maxCoord, b.maxCoord) - Math.max(a.minCoord, b.minCoord)

  return overlap >= -EPSILON
}

const setSegmentFixedCoord = (
  traces: SolvedTracePath[],
  segment: SegmentRef,
  fixedCoord: number,
) => {
  const path = traces[segment.traceIndex]!.tracePath
  const start = path[segment.pointIndex]!
  const end = path[segment.pointIndex + 1]!

  if (segment.orientation === "horizontal") {
    path[segment.pointIndex] = { ...start, y: fixedCoord }
    path[segment.pointIndex + 1] = { ...end, y: fixedCoord }
  } else {
    path[segment.pointIndex] = { ...start, x: fixedCoord }
    path[segment.pointIndex + 1] = { ...end, x: fixedCoord }
  }
}

export const mergeSameNetCloseTraceLines = (
  traces: SolvedTracePath[],
  {
    mergeDistance = DEFAULT_MERGE_DISTANCE,
  }: {
    mergeDistance?: number
  } = {},
): SolvedTracePath[] => {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  const segments = getSegments(outputTraces)

  for (const segment of segments) {
    if (!segment.movable) continue

    const nearbySegments = segments.filter((candidate) => {
      if (candidate === segment) return false
      if (candidate.globalConnNetId !== segment.globalConnNetId) return false
      if (candidate.orientation !== segment.orientation) return false
      if (Math.abs(candidate.fixedCoord - segment.fixedCoord) > mergeDistance) {
        return false
      }

      return projectionsOverlap(candidate, segment)
    })

    if (nearbySegments.length === 0) continue

    const anchors = nearbySegments.filter((candidate) => !candidate.movable)
    const candidates = anchors.length > 0 ? anchors : nearbySegments
    const totalLength = candidates.reduce(
      (sum, candidate) => sum + Math.max(candidate.length, EPSILON),
      0,
    )
    const targetFixedCoord =
      candidates.reduce(
        (sum, candidate) =>
          sum + candidate.fixedCoord * Math.max(candidate.length, EPSILON),
        0,
      ) / totalLength

    setSegmentFixedCoord(outputTraces, segment, targetFixedCoord)
  }

  return outputTraces.map((trace) => ({
    ...trace,
    tracePath: simplifyPath(trace.tracePath as Point[]),
  }))
}
