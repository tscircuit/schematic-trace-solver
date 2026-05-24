import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

type SegmentOrientation = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  segmentIndex: number
  orientation: SegmentOrientation
  axisCoord: number
  rangeMin: number
  rangeMax: number
  length: number
}

export interface MergeSameNetCloseTraceLinesOptions {
  closeThreshold?: number
  eps?: number
  maxIterations?: number
}

const DEFAULT_CLOSE_THRESHOLD = 0.3
const DEFAULT_EPS = 1e-6
const DEFAULT_MAX_ITERATIONS = 1000

const pointsEqual = (a: Point, b: Point, eps: number) =>
  Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps

const clonePoint = (p: Point): Point => ({ x: p.x, y: p.y })

const cloneTraces = (traces: SolvedTracePath[]): SolvedTracePath[] =>
  traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map(clonePoint),
  }))

const getSegmentsForTrace = (
  trace: SolvedTracePath,
  traceIndex: number,
  eps: number,
): SegmentRef[] => {
  const segments: SegmentRef[] = []

  for (let i = 0; i < trace.tracePath.length - 1; i++) {
    const p1 = trace.tracePath[i]!
    const p2 = trace.tracePath[i + 1]!
    const dx = Math.abs(p1.x - p2.x)
    const dy = Math.abs(p1.y - p2.y)

    if (dx <= eps && dy <= eps) continue

    if (dy <= eps) {
      segments.push({
        traceIndex,
        segmentIndex: i,
        orientation: "horizontal",
        axisCoord: (p1.y + p2.y) / 2,
        rangeMin: Math.min(p1.x, p2.x),
        rangeMax: Math.max(p1.x, p2.x),
        length: dx,
      })
    } else if (dx <= eps) {
      segments.push({
        traceIndex,
        segmentIndex: i,
        orientation: "vertical",
        axisCoord: (p1.x + p2.x) / 2,
        rangeMin: Math.min(p1.y, p2.y),
        rangeMax: Math.max(p1.y, p2.y),
        length: dy,
      })
    }
  }

  return segments
}

const projectedRangesOverlap = (a: SegmentRef, b: SegmentRef, eps: number) =>
  Math.min(a.rangeMax, b.rangeMax) - Math.max(a.rangeMin, b.rangeMin) > eps

const chooseAnchor = (a: SegmentRef, b: SegmentRef): SegmentRef => {
  if (a.length !== b.length) return a.length > b.length ? a : b
  if (a.traceIndex !== b.traceIndex) return a.traceIndex < b.traceIndex ? a : b
  return a.segmentIndex <= b.segmentIndex ? a : b
}

const setSegmentAxisCoord = (
  trace: SolvedTracePath,
  segmentIndex: number,
  orientation: SegmentOrientation,
  axisCoord: number,
) => {
  const p1 = trace.tracePath[segmentIndex]!
  const p2 = trace.tracePath[segmentIndex + 1]!

  if (orientation === "horizontal") {
    p1.y = axisCoord
    p2.y = axisCoord
  } else {
    p1.x = axisCoord
    p2.x = axisCoord
  }
}

const removeConsecutiveDuplicatePoints = (path: Point[], eps: number) => {
  const deduped: Point[] = []
  for (const point of path) {
    if (
      !deduped.length ||
      !pointsEqual(deduped[deduped.length - 1]!, point, eps)
    ) {
      deduped.push(point)
    }
  }
  return deduped
}

const restoreOriginalEndpoints = (
  trace: SolvedTracePath,
  originalTrace: SolvedTracePath,
  eps: number,
) => {
  const path = trace.tracePath
  if (path.length < 2) return

  const originalStart = originalTrace.tracePath[0]!
  const originalEnd =
    originalTrace.tracePath[originalTrace.tracePath.length - 1]!
  const shiftedStart = path[0]!
  const shiftedEnd = path[path.length - 1]!

  let restoredPath = path

  if (!pointsEqual(shiftedStart, originalStart, eps)) {
    restoredPath = [
      clonePoint(originalStart),
      clonePoint(shiftedStart),
      ...restoredPath.slice(1),
    ]
  }

  if (!pointsEqual(shiftedEnd, originalEnd, eps)) {
    restoredPath = [
      ...restoredPath.slice(0, -1),
      clonePoint(shiftedEnd),
      clonePoint(originalEnd),
    ]
  }

  trace.tracePath = simplifyPath(
    removeConsecutiveDuplicatePoints(restoredPath, eps),
  )
}

export const mergeSameNetCloseTraceLines = (
  traces: SolvedTracePath[],
  opts: MergeSameNetCloseTraceLinesOptions = {},
): SolvedTracePath[] => {
  const closeThreshold = opts.closeThreshold ?? DEFAULT_CLOSE_THRESHOLD
  const eps = opts.eps ?? DEFAULT_EPS
  const maxIterations = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS
  const outputTraces = cloneTraces(traces)
  const originalTraces = cloneTraces(traces)

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let mergedThisIteration = false

    const segmentsByNet = new Map<string, SegmentRef[]>()
    for (let traceIndex = 0; traceIndex < outputTraces.length; traceIndex++) {
      const trace = outputTraces[traceIndex]!
      const segments = getSegmentsForTrace(trace, traceIndex, eps)
      const existing = segmentsByNet.get(trace.globalConnNetId) ?? []
      existing.push(...segments)
      segmentsByNet.set(trace.globalConnNetId, existing)
    }

    for (const segments of segmentsByNet.values()) {
      for (let i = 0; i < segments.length && !mergedThisIteration; i++) {
        for (let j = i + 1; j < segments.length; j++) {
          const a = segments[i]!
          const b = segments[j]!

          if (a.traceIndex === b.traceIndex) continue
          if (a.orientation !== b.orientation) continue
          if (Math.abs(a.axisCoord - b.axisCoord) > closeThreshold) continue
          if (!projectedRangesOverlap(a, b, eps)) continue

          const anchor = chooseAnchor(a, b)
          const target = anchor === a ? b : a

          if (Math.abs(target.axisCoord - anchor.axisCoord) <= eps) continue

          setSegmentAxisCoord(
            outputTraces[target.traceIndex]!,
            target.segmentIndex,
            target.orientation,
            anchor.axisCoord,
          )
          mergedThisIteration = true
          break
        }
      }
      if (mergedThisIteration) break
    }

    if (!mergedThisIteration) break
  }

  for (let i = 0; i < outputTraces.length; i++) {
    restoreOriginalEndpoints(outputTraces[i]!, originalTraces[i]!, eps)
    outputTraces[i]!.tracePath = simplifyPath(
      removeConsecutiveDuplicatePoints(outputTraces[i]!.tracePath, eps),
    )
  }

  return outputTraces
}
