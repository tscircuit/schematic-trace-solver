import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-9
const DEFAULT_MAX_DISTANCE = 0.16

type SegmentOrientation = "horizontal" | "vertical"

type SegmentInfo = {
  traceIndex: number
  segmentIndex: number
  orientation: SegmentOrientation
  fixedCoord: number
  min: number
  max: number
  canMove: boolean
}

const pointsEqual = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

const dedupeConsecutivePoints = (path: Point[]): Point[] => {
  const result: Point[] = []
  for (const point of path) {
    const prev = result[result.length - 1]
    if (!prev || !pointsEqual(prev, point)) {
      result.push(point)
    }
  }
  return result
}

const getOrientation = (a: Point, b: Point): SegmentOrientation | null => {
  if (Math.abs(a.y - b.y) < EPS) return "horizontal"
  if (Math.abs(a.x - b.x) < EPS) return "vertical"
  return null
}

const getSegmentsForTrace = (
  trace: SolvedTracePath,
  traceIndex: number,
): SegmentInfo[] => {
  const segments: SegmentInfo[] = []
  for (let i = 0; i < trace.tracePath.length - 1; i++) {
    const a = trace.tracePath[i]!
    const b = trace.tracePath[i + 1]!
    const orientation = getOrientation(a, b)
    if (!orientation) continue

    const isEndpointSegment = i === 0 || i === trace.tracePath.length - 2
    segments.push({
      traceIndex,
      segmentIndex: i,
      orientation,
      fixedCoord: orientation === "horizontal" ? a.y : a.x,
      min:
        orientation === "horizontal" ? Math.min(a.x, b.x) : Math.min(a.y, b.y),
      max:
        orientation === "horizontal" ? Math.max(a.x, b.x) : Math.max(a.y, b.y),
      canMove: !isEndpointSegment,
    })
  }
  return segments
}

const getOverlapLength = (a: SegmentInfo, b: SegmentInfo) =>
  Math.min(a.max, b.max) - Math.max(a.min, b.min)

const rangesOverlap = (a1: number, a2: number, b1: number, b2: number) =>
  Math.min(a2, b2) - Math.max(a1, b1) >= -EPS

const segmentsIntersect = (
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): boolean => {
  const aOrientation = getOrientation(a1, a2)
  const bOrientation = getOrientation(b1, b2)
  if (!aOrientation || !bOrientation) return false

  if (aOrientation === "horizontal" && bOrientation === "horizontal") {
    return (
      Math.abs(a1.y - b1.y) < EPS &&
      rangesOverlap(
        Math.min(a1.x, a2.x),
        Math.max(a1.x, a2.x),
        Math.min(b1.x, b2.x),
        Math.max(b1.x, b2.x),
      )
    )
  }

  if (aOrientation === "vertical" && bOrientation === "vertical") {
    return (
      Math.abs(a1.x - b1.x) < EPS &&
      rangesOverlap(
        Math.min(a1.y, a2.y),
        Math.max(a1.y, a2.y),
        Math.min(b1.y, b2.y),
        Math.max(b1.y, b2.y),
      )
    )
  }

  const horizontal =
    aOrientation === "horizontal"
      ? { start: a1, end: a2 }
      : { start: b1, end: b2 }
  const vertical =
    aOrientation === "vertical"
      ? { start: a1, end: a2 }
      : { start: b1, end: b2 }

  return (
    vertical.start.x >= Math.min(horizontal.start.x, horizontal.end.x) - EPS &&
    vertical.start.x <= Math.max(horizontal.start.x, horizontal.end.x) + EPS &&
    horizontal.start.y >= Math.min(vertical.start.y, vertical.end.y) - EPS &&
    horizontal.start.y <= Math.max(vertical.start.y, vertical.end.y) + EPS
  )
}

const pathsIntersect = (pathA: Point[], pathB: Point[]): boolean => {
  for (let i = 0; i < pathA.length - 1; i++) {
    for (let j = 0; j < pathB.length - 1; j++) {
      if (
        segmentsIntersect(pathA[i]!, pathA[i + 1]!, pathB[j]!, pathB[j + 1]!)
      ) {
        return true
      }
    }
  }
  return false
}

const introducesDifferentNetIntersection = ({
  trace,
  updatedPath,
  allTraces,
}: {
  trace: SolvedTracePath
  updatedPath: Point[]
  allTraces: SolvedTracePath[]
}) => {
  for (const otherTrace of allTraces) {
    if (otherTrace.mspPairId === trace.mspPairId) continue
    if (otherTrace.globalConnNetId === trace.globalConnNetId) continue

    const alreadyIntersected = pathsIntersect(
      trace.tracePath,
      otherTrace.tracePath,
    )
    const nowIntersects = pathsIntersect(updatedPath, otherTrace.tracePath)
    if (!alreadyIntersected && nowIntersects) return true
  }
  return false
}

const moveSegmentToCoord = (
  trace: SolvedTracePath,
  segment: SegmentInfo,
  fixedCoord: number,
): Point[] => {
  const updatedPath = trace.tracePath.map((point) => ({ ...point }))
  const p1 = updatedPath[segment.segmentIndex]!
  const p2 = updatedPath[segment.segmentIndex + 1]!

  if (segment.orientation === "horizontal") {
    p1.y = fixedCoord
    p2.y = fixedCoord
  } else {
    p1.x = fixedCoord
    p2.x = fixedCoord
  }

  return simplifyPath(dedupeConsecutivePoints(updatedPath))
}

export const combineCloseSameNetSegments = (
  traces: SolvedTracePath[],
  opts: { maxDistance?: number } = {},
): SolvedTracePath[] => {
  const maxDistance = opts.maxDistance ?? DEFAULT_MAX_DISTANCE
  let outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  let changed = true
  let passCount = 0
  const maxPasses = Math.max(1, traces.length * 4)

  while (changed && passCount < maxPasses) {
    changed = false
    passCount++

    const tracesByNet = new Map<string, number[]>()
    outputTraces.forEach((trace, traceIndex) => {
      if (!trace.globalConnNetId) return
      const traceIndexes = tracesByNet.get(trace.globalConnNetId) ?? []
      traceIndexes.push(traceIndex)
      tracesByNet.set(trace.globalConnNetId, traceIndexes)
    })

    for (const traceIndexes of tracesByNet.values()) {
      if (traceIndexes.length < 2) continue

      const segments = traceIndexes.flatMap((traceIndex) =>
        getSegmentsForTrace(outputTraces[traceIndex]!, traceIndex),
      )

      for (let i = 0; i < segments.length; i++) {
        const a = segments[i]!
        for (let j = i + 1; j < segments.length; j++) {
          const b = segments[j]!
          if (a.traceIndex === b.traceIndex) continue
          if (a.orientation !== b.orientation) continue
          if (getOverlapLength(a, b) <= EPS) continue

          const distance = Math.abs(a.fixedCoord - b.fixedCoord)
          if (distance <= EPS || distance > maxDistance) continue

          const movingSegment = b.canMove ? b : a.canMove ? a : null
          const anchorSegment = movingSegment === b ? a : b
          if (!movingSegment) continue

          const movingTrace = outputTraces[movingSegment.traceIndex]!
          const updatedPath = moveSegmentToCoord(
            movingTrace,
            movingSegment,
            anchorSegment.fixedCoord,
          )

          if (
            introducesDifferentNetIntersection({
              trace: movingTrace,
              updatedPath,
              allTraces: outputTraces,
            })
          ) {
            continue
          }

          outputTraces = outputTraces.map((trace, traceIndex) =>
            traceIndex === movingSegment.traceIndex
              ? { ...trace, tracePath: updatedPath }
              : trace,
          )
          changed = true
          break
        }
        if (changed) break
      }
      if (changed) break
    }
  }

  return outputTraces
}
