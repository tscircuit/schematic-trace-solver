import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-9

type SegmentOrientation = "horizontal" | "vertical"

interface SegmentInfo {
  traceIndex: number
  segmentIndex: number
  orientation: SegmentOrientation
  coordinate: number
  rangeMin: number
  rangeMax: number
  length: number
  movable: boolean
}

export interface MergeCloseSameNetTraceSegmentsOptions {
  maxOffset?: number
  maxGap?: number
  maxPasses?: number
}

const getSegmentInfo = (
  path: Point[],
  traceIndex: number,
  segmentIndex: number,
): SegmentInfo | null => {
  const p1 = path[segmentIndex]
  const p2 = path[segmentIndex + 1]
  if (!p1 || !p2) return null

  const isVertical = Math.abs(p1.x - p2.x) < EPS
  const isHorizontal = Math.abs(p1.y - p2.y) < EPS
  if (!isVertical && !isHorizontal) return null

  const orientation = isVertical ? "vertical" : "horizontal"
  const rangeMin =
    orientation === "vertical" ? Math.min(p1.y, p2.y) : Math.min(p1.x, p2.x)
  const rangeMax =
    orientation === "vertical" ? Math.max(p1.y, p2.y) : Math.max(p1.x, p2.x)

  return {
    traceIndex,
    segmentIndex,
    orientation,
    coordinate: orientation === "vertical" ? p1.x : p1.y,
    rangeMin,
    rangeMax,
    length: rangeMax - rangeMin,
    // Moving first/last segments would move pins. Interior segments can slide
    // onto nearby same-net rails while keeping trace endpoints fixed.
    movable: segmentIndex > 0 && segmentIndex < path.length - 2,
  }
}

const rangesOverlapOrNearlyTouch = (
  a: SegmentInfo,
  b: SegmentInfo,
  maxGap: number,
) => {
  if (a.rangeMax < b.rangeMin) return b.rangeMin - a.rangeMax <= maxGap
  if (b.rangeMax < a.rangeMin) return a.rangeMin - b.rangeMax <= maxGap
  return true
}

const getAlignmentTarget = (a: SegmentInfo, b: SegmentInfo) => {
  if (!a.movable && !b.movable) return null
  if (!a.movable) return a.coordinate
  if (!b.movable) return b.coordinate
  return a.length >= b.length ? a.coordinate : b.coordinate
}

const setSegmentCoordinate = (
  path: Point[],
  segmentIndex: number,
  orientation: SegmentOrientation,
  coordinate: number,
) => {
  const p1 = path[segmentIndex]!
  const p2 = path[segmentIndex + 1]!
  if (orientation === "vertical") {
    p1.x = coordinate
    p2.x = coordinate
  } else {
    p1.y = coordinate
    p2.y = coordinate
  }
}

const segmentRangesOverlap = (a: SegmentInfo, b: SegmentInfo) =>
  Math.min(a.rangeMax, b.rangeMax) - Math.max(a.rangeMin, b.rangeMin) > EPS

const withSegmentCoordinate = (
  path: Point[],
  segmentIndex: number,
  orientation: SegmentOrientation,
  coordinate: number,
) => {
  const p1 = { ...path[segmentIndex]! }
  const p2 = { ...path[segmentIndex + 1]! }
  if (orientation === "vertical") {
    p1.x = coordinate
    p2.x = coordinate
  } else {
    p1.y = coordinate
    p2.y = coordinate
  }
  return [p1, p2] as const
}

const wouldOverlapDifferentNetTrace = (
  traces: SolvedTracePath[],
  movingTrace: SolvedTracePath,
  segmentIndex: number,
  orientation: SegmentOrientation,
  coordinate: number,
) => {
  const candidateSegment = getSegmentInfo(
    withSegmentCoordinate(
      movingTrace.tracePath,
      segmentIndex,
      orientation,
      coordinate,
    ),
    0,
    0,
  )
  if (candidateSegment === null) return true

  return traces.some((trace) => {
    if (trace.globalConnNetId === movingTrace.globalConnNetId) return false

    return trace.tracePath.slice(0, -1).some((_, otherSegmentIndex) => {
      const otherSegment = getSegmentInfo(trace.tracePath, 0, otherSegmentIndex)
      if (otherSegment === null) return false
      if (otherSegment.orientation !== candidateSegment.orientation) {
        return false
      }
      if (
        Math.abs(otherSegment.coordinate - candidateSegment.coordinate) > EPS
      ) {
        return false
      }
      return segmentRangesOverlap(candidateSegment, otherSegment)
    })
  })
}

const collectSegments = (traces: SolvedTracePath[]) =>
  traces.flatMap((trace, traceIndex) =>
    trace.tracePath
      .slice(0, -1)
      .map((_, segmentIndex) =>
        getSegmentInfo(trace.tracePath, traceIndex, segmentIndex),
      )
      .filter((segment): segment is SegmentInfo => segment !== null),
  )

export const mergeCloseSameNetTraceSegments = (
  traces: SolvedTracePath[],
  {
    maxOffset = 0.2,
    maxGap = 0.2,
    maxPasses = 8,
  }: MergeCloseSameNetTraceSegmentsOptions = {},
): SolvedTracePath[] => {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  const tracesByNetId = new Map<string, SolvedTracePath[]>()
  for (const trace of outputTraces) {
    const tracesForNet = tracesByNetId.get(trace.globalConnNetId) ?? []
    tracesForNet.push(trace)
    tracesByNetId.set(trace.globalConnNetId, tracesForNet)
  }

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false

    for (const sameNetTraces of tracesByNetId.values()) {
      if (sameNetTraces.length < 2) continue

      const segments = collectSegments(sameNetTraces)
      for (let i = 0; i < segments.length; i++) {
        const a = segments[i]!
        for (let j = i + 1; j < segments.length; j++) {
          const b = segments[j]!
          if (a.traceIndex === b.traceIndex) continue
          if (a.orientation !== b.orientation) continue
          if (Math.abs(a.coordinate - b.coordinate) > maxOffset) continue
          if (!rangesOverlapOrNearlyTouch(a, b, maxGap)) continue

          const targetCoordinate = getAlignmentTarget(a, b)
          if (targetCoordinate === null) continue

          if (a.movable && Math.abs(a.coordinate - targetCoordinate) > EPS) {
            const trace = sameNetTraces[a.traceIndex]!
            if (
              !wouldOverlapDifferentNetTrace(
                outputTraces,
                trace,
                a.segmentIndex,
                a.orientation,
                targetCoordinate,
              )
            ) {
              setSegmentCoordinate(
                trace.tracePath,
                a.segmentIndex,
                a.orientation,
                targetCoordinate,
              )
              changed = true
            }
          }

          if (b.movable && Math.abs(b.coordinate - targetCoordinate) > EPS) {
            const trace = sameNetTraces[b.traceIndex]!
            if (
              !wouldOverlapDifferentNetTrace(
                outputTraces,
                trace,
                b.segmentIndex,
                b.orientation,
                targetCoordinate,
              )
            ) {
              setSegmentCoordinate(
                trace.tracePath,
                b.segmentIndex,
                b.orientation,
                targetCoordinate,
              )
              changed = true
            }
          }
        }
      }
    }

    if (!changed) break
  }

  return outputTraces.map((trace) => ({
    ...trace,
    tracePath: simplifyPath(trace.tracePath),
  }))
}
