import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-6

type Orientation = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  coord: number
  start: number
  end: number
  length: number
  isEndpointSegment: boolean
  isInternalSegment: boolean
  globalConnNetId: string
}

export interface CoalesceSameNetTracesResult {
  traces: SolvedTracePath[]
  coalescedSegmentCount: number
}

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  tracePath: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
})

const getSegmentRef = (
  trace: SolvedTracePath,
  traceIndex: number,
  segmentIndex: number,
): SegmentRef | null => {
  const p1 = trace.tracePath[segmentIndex]
  const p2 = trace.tracePath[segmentIndex + 1]
  if (!p1 || !p2) return null

  const isInternalSegment =
    segmentIndex > 0 && segmentIndex < trace.tracePath.length - 2
  const isEndpointSegment =
    segmentIndex === 0 || segmentIndex === trace.tracePath.length - 2

  if (isHorizontal(p1, p2, EPS)) {
    const start = Math.min(p1.x, p2.x)
    const end = Math.max(p1.x, p2.x)
    return {
      traceIndex,
      segmentIndex,
      orientation: "horizontal",
      coord: p1.y,
      start,
      end,
      length: end - start,
      isEndpointSegment,
      isInternalSegment,
      globalConnNetId: trace.globalConnNetId,
    }
  }

  if (isVertical(p1, p2, EPS)) {
    const start = Math.min(p1.y, p2.y)
    const end = Math.max(p1.y, p2.y)
    return {
      traceIndex,
      segmentIndex,
      orientation: "vertical",
      coord: p1.x,
      start,
      end,
      length: end - start,
      isEndpointSegment,
      isInternalSegment,
      globalConnNetId: trace.globalConnNetId,
    }
  }

  return null
}

const collectSegments = (traces: SolvedTracePath[]): SegmentRef[] => {
  const segments: SegmentRef[] = []
  traces.forEach((trace, traceIndex) => {
    for (
      let segmentIndex = 0;
      segmentIndex < trace.tracePath.length - 1;
      segmentIndex++
    ) {
      const segment = getSegmentRef(trace, traceIndex, segmentIndex)
      if (segment && segment.length > EPS) {
        segments.push(segment)
      }
    }
  })
  return segments
}

const getOverlapLength = (a: SegmentRef, b: SegmentRef): number =>
  Math.min(a.end, b.end) - Math.max(a.start, b.start)

const getOverlapRange = (a: SegmentRef, b: SegmentRef) => ({
  start: Math.max(a.start, b.start),
  end: Math.min(a.end, b.end),
})

const getPathWithSegmentCoord = (
  path: Point[],
  segmentIndex: number,
  orientation: Orientation,
  coord: number,
): Point[] =>
  path.map((point, index) => {
    if (index !== segmentIndex && index !== segmentIndex + 1) {
      return { x: point.x, y: point.y }
    }
    return orientation === "horizontal"
      ? { x: point.x, y: coord }
      : { x: coord, y: point.y }
  })

const getMajorCoord = (point: Point, orientation: Orientation) =>
  orientation === "horizontal" ? point.x : point.y

const withMajorCoord = (
  point: Point,
  orientation: Orientation,
  coord: number,
): Point =>
  orientation === "horizontal"
    ? { x: coord, y: point.y }
    : { x: point.x, y: coord }

const removeConsecutiveDuplicatePoints = (path: Point[]) => {
  const deduped: Point[] = []
  for (const point of path) {
    if (
      deduped.length === 0 ||
      !samePoint(deduped[deduped.length - 1]!, point)
    ) {
      deduped.push(point)
    }
  }
  return deduped
}

const getPathWithTrimmedEndpointOverlap = (
  trace: SolvedTracePath,
  segment: SegmentRef,
  overlap: { start: number; end: number },
): Point[] | null => {
  if (!segment.isEndpointSegment || trace.tracePath.length <= 2) return null

  const endpointIndex =
    segment.segmentIndex === 0 ? 0 : segment.segmentIndex + 1
  const neighborIndex = segment.segmentIndex === 0 ? 1 : segment.segmentIndex
  const endpoint = trace.tracePath[endpointIndex]
  const neighbor = trace.tracePath[neighborIndex]
  if (!endpoint || !neighbor) return null

  const endpointMajor = getMajorCoord(endpoint, segment.orientation)
  const neighborMajor = getMajorCoord(neighbor, segment.orientation)
  let newEndpointMajor: number | null = null

  if (endpointMajor < neighborMajor && overlap.start <= endpointMajor + EPS) {
    newEndpointMajor = Math.min(overlap.end, neighborMajor)
  } else if (
    endpointMajor > neighborMajor &&
    overlap.end >= endpointMajor - EPS
  ) {
    newEndpointMajor = Math.max(overlap.start, neighborMajor)
  }

  if (newEndpointMajor === null) return null
  if (Math.abs(newEndpointMajor - endpointMajor) < EPS) return null

  const candidatePath = trace.tracePath.map((point, index) =>
    index === endpointIndex
      ? withMajorCoord(point, segment.orientation, newEndpointMajor)
      : { x: point.x, y: point.y },
  )
  const dedupedPath = removeConsecutiveDuplicatePoints(candidatePath)
  if (dedupedPath.length < 2) return null

  return simplifyPath(dedupedPath)
}

const samePoint = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

const pointOnSegment = (point: Point, a: Point, b: Point) => {
  if (isHorizontal(a, b, EPS)) {
    return (
      Math.abs(point.y - a.y) < EPS &&
      point.x >= Math.min(a.x, b.x) - EPS &&
      point.x <= Math.max(a.x, b.x) + EPS
    )
  }
  if (isVertical(a, b, EPS)) {
    return (
      Math.abs(point.x - a.x) < EPS &&
      point.y >= Math.min(a.y, b.y) - EPS &&
      point.y <= Math.max(a.y, b.y) + EPS
    )
  }
  return false
}

const endpointOnlyTouch = (
  point: Point,
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
) =>
  (samePoint(point, a1) || samePoint(point, a2)) &&
  (samePoint(point, b1) || samePoint(point, b2))

const axisAlignedSegmentsIntersect = (
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): boolean => {
  const aHorizontal = isHorizontal(a1, a2, EPS)
  const aVertical = isVertical(a1, a2, EPS)
  const bHorizontal = isHorizontal(b1, b2, EPS)
  const bVertical = isVertical(b1, b2, EPS)
  if ((!aHorizontal && !aVertical) || (!bHorizontal && !bVertical)) return false

  if (aHorizontal && bHorizontal) {
    if (Math.abs(a1.y - b1.y) >= EPS) return false
    return (
      Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) -
        Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x)) >
      EPS
    )
  }

  if (aVertical && bVertical) {
    if (Math.abs(a1.x - b1.x) >= EPS) return false
    return (
      Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) -
        Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y)) >
      EPS
    )
  }

  const horizontalStart = aHorizontal ? a1 : b1
  const horizontalEnd = aHorizontal ? a2 : b2
  const verticalStart = aVertical ? a1 : b1
  const verticalEnd = aVertical ? a2 : b2
  const intersection = { x: verticalStart.x, y: horizontalStart.y }

  if (
    pointOnSegment(intersection, horizontalStart, horizontalEnd) &&
    pointOnSegment(intersection, verticalStart, verticalEnd)
  ) {
    return !endpointOnlyTouch(intersection, a1, a2, b1, b2)
  }

  return false
}

const pathCollidesWithDifferentNetTrace = (
  path: Point[],
  globalConnNetId: string,
  otherTrace: SolvedTracePath,
) => {
  if (otherTrace.globalConnNetId === globalConnNetId) return false

  for (let i = 0; i < path.length - 1; i++) {
    for (let j = 0; j < otherTrace.tracePath.length - 1; j++) {
      if (
        axisAlignedSegmentsIntersect(
          path[i]!,
          path[i + 1]!,
          otherTrace.tracePath[j]!,
          otherTrace.tracePath[j + 1]!,
        )
      ) {
        return true
      }
    }
  }

  return false
}

const isSafeTracePath = (
  candidatePath: Point[],
  candidateNetId: string,
  traces: SolvedTracePath[],
  candidateTraceIndex: number,
) =>
  traces.every((trace, traceIndex) => {
    if (traceIndex === candidateTraceIndex) return true
    return !pathCollidesWithDifferentNetTrace(
      candidatePath,
      candidateNetId,
      trace,
    )
  })

const pathsEqual = (a: Point[], b: Point[]) =>
  a.length === b.length &&
  a.every((point, index) => samePoint(point, b[index]!))

export const coalesceSameNetTraces = (
  traces: SolvedTracePath[],
  opts: {
    maxSnapDistance?: number
    minOverlap?: number
    maxPasses?: number
  } = {},
): CoalesceSameNetTracesResult => {
  const maxSnapDistance = opts.maxSnapDistance ?? 0.25
  const minOverlap = opts.minOverlap ?? 0.05
  const maxPasses = opts.maxPasses ?? 20
  const outputTraces = traces.map(cloneTrace)
  let coalescedSegmentCount = 0

  for (let pass = 0; pass < maxPasses; pass++) {
    const segments = collectSegments(outputTraces)
    let changedThisPass = false

    for (let i = 0; i < segments.length; i++) {
      const a = segments[i]!
      for (let j = i + 1; j < segments.length; j++) {
        const b = segments[j]!
        if (a.traceIndex === b.traceIndex) continue
        if (a.globalConnNetId !== b.globalConnNetId) continue
        if (a.orientation !== b.orientation) continue

        const coordDistance = Math.abs(a.coord - b.coord)
        const overlapLength = getOverlapLength(a, b)
        if (overlapLength < minOverlap) continue

        if (coordDistance < EPS) {
          const overlap = getOverlapRange(a, b)
          const trimCandidates = [a, b]
            .filter((segment) => segment.isEndpointSegment)
            .sort((left, right) => left.length - right.length)

          for (const moving of trimCandidates) {
            const movingTrace = outputTraces[moving.traceIndex]!
            const candidatePath = getPathWithTrimmedEndpointOverlap(
              movingTrace,
              moving,
              overlap,
            )
            if (!candidatePath) continue
            if (pathsEqual(candidatePath, movingTrace.tracePath)) continue
            if (
              !isSafeTracePath(
                candidatePath,
                movingTrace.globalConnNetId,
                outputTraces,
                moving.traceIndex,
              )
            ) {
              continue
            }

            outputTraces[moving.traceIndex] = {
              ...movingTrace,
              tracePath: candidatePath,
            }
            coalescedSegmentCount++
            changedThisPass = true
            break
          }

          if (changedThisPass) break
          continue
        }

        if (coordDistance > maxSnapDistance) continue
        if (!a.isInternalSegment || !b.isInternalSegment) continue

        const [target, moving] = a.length >= b.length ? [a, b] : [b, a]
        const movingTrace = outputTraces[moving.traceIndex]!
        const candidatePath = simplifyPath(
          getPathWithSegmentCoord(
            movingTrace.tracePath,
            moving.segmentIndex,
            moving.orientation,
            target.coord,
          ),
        )

        if (pathsEqual(candidatePath, movingTrace.tracePath)) continue
        if (
          !isSafeTracePath(
            candidatePath,
            movingTrace.globalConnNetId,
            outputTraces,
            moving.traceIndex,
          )
        ) {
          continue
        }

        outputTraces[moving.traceIndex] = {
          ...movingTrace,
          tracePath: candidatePath,
        }
        coalescedSegmentCount++
        changedThisPass = true
        break
      }
      if (changedThisPass) break
    }

    if (!changedThisPass) break
  }

  return {
    traces: outputTraces,
    coalescedSegmentCount,
  }
}
