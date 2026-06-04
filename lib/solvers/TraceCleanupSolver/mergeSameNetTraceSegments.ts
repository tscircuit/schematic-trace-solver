import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
  segmentIntersectsRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { simplifyPath } from "./simplifyPath"

type SegmentAxis = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  segmentIndex: number
  axis: SegmentAxis
  fixedCoord: number
  min: number
  max: number
  length: number
}

const EPS = 1e-6
const DEFAULT_MAX_MERGE_DISTANCE = 0.15

const normalizePath = (path: Point[]): Point[] => {
  const withoutDuplicates: Point[] = []
  for (const point of path) {
    const previous = withoutDuplicates[withoutDuplicates.length - 1]
    if (
      !previous ||
      Math.abs(previous.x - point.x) > EPS ||
      Math.abs(previous.y - point.y) > EPS
    ) {
      withoutDuplicates.push({ x: point.x, y: point.y })
    }
  }

  return simplifyPath(withoutDuplicates as any).map((p) => ({
    x: p.x,
    y: p.y,
  }))
}

const isOrthogonalPath = (path: Point[]) => {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    if (!isHorizontal(a, b, EPS) && !isVertical(a, b, EPS)) return false
  }
  return true
}

const getMovableSegmentRef = (
  trace: SolvedTracePath,
  traceIndex: number,
  segmentIndex: number,
): SegmentRef | null => {
  const path = trace.tracePath
  if (segmentIndex <= 0 || segmentIndex >= path.length - 2) return null

  const a = path[segmentIndex]!
  const b = path[segmentIndex + 1]!
  const previous = path[segmentIndex - 1]!
  const next = path[segmentIndex + 2]!

  if (isHorizontal(a, b, EPS)) {
    if (!isVertical(previous, a, EPS) || !isVertical(b, next, EPS)) return null

    const min = Math.min(a.x, b.x)
    const max = Math.max(a.x, b.x)
    if (max - min < EPS) return null

    return {
      traceIndex,
      segmentIndex,
      axis: "horizontal",
      fixedCoord: a.y,
      min,
      max,
      length: max - min,
    }
  }

  if (isVertical(a, b, EPS)) {
    if (!isHorizontal(previous, a, EPS) || !isHorizontal(b, next, EPS)) {
      return null
    }

    const min = Math.min(a.y, b.y)
    const max = Math.max(a.y, b.y)
    if (max - min < EPS) return null

    return {
      traceIndex,
      segmentIndex,
      axis: "vertical",
      fixedCoord: a.x,
      min,
      max,
      length: max - min,
    }
  }

  return null
}

const collectMovableSegments = (traces: SolvedTracePath[]): SegmentRef[] => {
  const refs: SegmentRef[] = []
  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const trace = traces[traceIndex]!
    for (
      let segmentIndex = 0;
      segmentIndex < trace.tracePath.length - 1;
      segmentIndex++
    ) {
      const ref = getMovableSegmentRef(trace, traceIndex, segmentIndex)
      if (ref) refs.push(ref)
    }
  }
  return refs
}

const areNetsEquivalent = (
  netA: string,
  netB: string,
  mergedLabelNetIdMap: Record<string, Set<string>>,
) => {
  if (netA === netB) return true

  return Object.values(mergedLabelNetIdMap).some(
    (originalNetIds) => originalNetIds.has(netA) && originalNetIds.has(netB),
  )
}

const areSegmentsCloseEnoughToMerge = (
  a: SegmentRef,
  b: SegmentRef,
  maxMergeDistance: number,
) => {
  if (a.axis !== b.axis) return false
  if (Math.abs(a.fixedCoord - b.fixedCoord) > maxMergeDistance) return false

  const rangeGap = Math.max(0, Math.max(a.min, b.min) - Math.min(a.max, b.max))
  return rangeGap <= maxMergeDistance
}

const moveSegmentToFixedCoord = (
  trace: SolvedTracePath,
  segmentIndex: number,
  axis: SegmentAxis,
  fixedCoord: number,
) => {
  const path = trace.tracePath.map((p) => ({ x: p.x, y: p.y }))

  if (axis === "horizontal") {
    path[segmentIndex]!.y = fixedCoord
    path[segmentIndex + 1]!.y = fixedCoord
  } else {
    path[segmentIndex]!.x = fixedCoord
    path[segmentIndex + 1]!.x = fixedCoord
  }

  return path
}

const getLabelObstacles = (
  allLabelPlacements: NetLabelPlacement[],
  paddingBuffer: number,
) =>
  allLabelPlacements.map((label) => ({
    chipId: `net-label-${label.globalConnNetId}`,
    minX: label.center.x - label.width / 2 - paddingBuffer,
    maxX: label.center.x + label.width / 2 + paddingBuffer,
    minY: label.center.y - label.height / 2 - paddingBuffer,
    maxY: label.center.y + label.height / 2 + paddingBuffer,
  }))

const segmentsIntersect = (a1: Point, a2: Point, b1: Point, b2: Point) => {
  const aHorizontal = isHorizontal(a1, a2, EPS)
  const aVertical = isVertical(a1, a2, EPS)
  const bHorizontal = isHorizontal(b1, b2, EPS)
  const bVertical = isVertical(b1, b2, EPS)

  if (aHorizontal && bHorizontal) {
    if (Math.abs(a1.y - b1.y) > EPS) return false
    const overlap =
      Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) -
      Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x))
    return overlap > EPS
  }

  if (aVertical && bVertical) {
    if (Math.abs(a1.x - b1.x) > EPS) return false
    const overlap =
      Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) -
      Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y))
    return overlap > EPS
  }

  if (aHorizontal && bVertical) {
    const withinA =
      b1.x >= Math.min(a1.x, a2.x) - EPS && b1.x <= Math.max(a1.x, a2.x) + EPS
    const withinB =
      a1.y >= Math.min(b1.y, b2.y) - EPS && a1.y <= Math.max(b1.y, b2.y) + EPS
    return withinA && withinB
  }

  if (aVertical && bHorizontal) {
    return segmentsIntersect(b1, b2, a1, a2)
  }

  return false
}

const isMovedSegmentSafe = ({
  traces,
  traceIndex,
  segmentIndex,
  movedPath,
  inputProblem,
  allLabelPlacements,
  mergedLabelNetIdMap,
  paddingBuffer,
}: {
  traces: SolvedTracePath[]
  traceIndex: number
  segmentIndex: number
  movedPath: Point[]
  inputProblem: InputProblem
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
}) => {
  const trace = traces[traceIndex]!
  const changedSegmentIndexes = [
    segmentIndex - 1,
    segmentIndex,
    segmentIndex + 1,
  ].filter((i) => i >= 0 && i < movedPath.length - 1)

  const obstacles = [
    ...getObstacleRects(inputProblem),
    ...getLabelObstacles(allLabelPlacements, paddingBuffer),
  ]

  for (const changedSegmentIndex of changedSegmentIndexes) {
    const a = movedPath[changedSegmentIndex]!
    const b = movedPath[changedSegmentIndex + 1]!
    if (Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS) continue

    for (const obstacle of obstacles) {
      if (segmentIntersectsRect(a, b, obstacle as any, EPS)) return false
    }

    for (
      let otherTraceIndex = 0;
      otherTraceIndex < traces.length;
      otherTraceIndex++
    ) {
      if (otherTraceIndex === traceIndex) continue

      const otherTrace = traces[otherTraceIndex]!
      if (
        areNetsEquivalent(
          trace.globalConnNetId,
          otherTrace.globalConnNetId,
          mergedLabelNetIdMap,
        )
      ) {
        continue
      }

      for (
        let otherSegmentIndex = 0;
        otherSegmentIndex < otherTrace.tracePath.length - 1;
        otherSegmentIndex++
      ) {
        const otherA = otherTrace.tracePath[otherSegmentIndex]!
        const otherB = otherTrace.tracePath[otherSegmentIndex + 1]!
        if (segmentsIntersect(a, b, otherA, otherB)) return false
      }
    }
  }

  return true
}

const tryMoveSegment = ({
  traces,
  segment,
  targetFixedCoord,
  inputProblem,
  allLabelPlacements,
  mergedLabelNetIdMap,
  paddingBuffer,
}: {
  traces: SolvedTracePath[]
  segment: SegmentRef
  targetFixedCoord: number
  inputProblem: InputProblem
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
}): SolvedTracePath | null => {
  const trace = traces[segment.traceIndex]!
  if (Math.abs(segment.fixedCoord - targetFixedCoord) < EPS) return null

  const movedPath = moveSegmentToFixedCoord(
    trace,
    segment.segmentIndex,
    segment.axis,
    targetFixedCoord,
  )

  if (
    !isMovedSegmentSafe({
      traces,
      traceIndex: segment.traceIndex,
      segmentIndex: segment.segmentIndex,
      movedPath,
      inputProblem,
      allLabelPlacements,
      mergedLabelNetIdMap,
      paddingBuffer,
    })
  ) {
    return null
  }

  const normalizedPath = normalizePath(movedPath)
  const originalStart = trace.tracePath[0]!
  const originalEnd = trace.tracePath[trace.tracePath.length - 1]!
  const normalizedStart = normalizedPath[0]!
  const normalizedEnd = normalizedPath[normalizedPath.length - 1]!

  if (
    Math.abs(normalizedStart.x - originalStart.x) > EPS ||
    Math.abs(normalizedStart.y - originalStart.y) > EPS ||
    Math.abs(normalizedEnd.x - originalEnd.x) > EPS ||
    Math.abs(normalizedEnd.y - originalEnd.y) > EPS
  ) {
    return null
  }

  if (!isOrthogonalPath(normalizedPath)) return null

  return {
    ...trace,
    tracePath: normalizedPath,
  }
}

export const mergeSameNetTraceSegments = ({
  traces,
  inputProblem,
  allLabelPlacements,
  mergedLabelNetIdMap,
  paddingBuffer,
  maxMergeDistance = DEFAULT_MAX_MERGE_DISTANCE,
}: {
  traces: SolvedTracePath[]
  inputProblem: InputProblem
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
  maxMergeDistance?: number
}): SolvedTracePath[] => {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: normalizePath(trace.tracePath),
  }))

  for (let pass = 0; pass < 25; pass++) {
    const segments = collectMovableSegments(outputTraces)
    let changed = false

    for (let i = 0; i < segments.length; i++) {
      const a = segments[i]!
      const traceA = outputTraces[a.traceIndex]!

      for (let j = i + 1; j < segments.length; j++) {
        const b = segments[j]!
        const traceB = outputTraces[b.traceIndex]!

        if (a.traceIndex === b.traceIndex) continue
        if (
          !areNetsEquivalent(
            traceA.globalConnNetId,
            traceB.globalConnNetId,
            mergedLabelNetIdMap,
          )
        ) {
          continue
        }
        if (!areSegmentsCloseEnoughToMerge(a, b, maxMergeDistance)) continue

        const [firstCandidate, secondCandidate] =
          a.length <= b.length ? [a, b] : [b, a]

        const movedFirst = tryMoveSegment({
          traces: outputTraces,
          segment: firstCandidate,
          targetFixedCoord: secondCandidate.fixedCoord,
          inputProblem,
          allLabelPlacements,
          mergedLabelNetIdMap,
          paddingBuffer,
        })

        if (movedFirst) {
          outputTraces[firstCandidate.traceIndex] = movedFirst
          changed = true
          break
        }

        const movedSecond = tryMoveSegment({
          traces: outputTraces,
          segment: secondCandidate,
          targetFixedCoord: firstCandidate.fixedCoord,
          inputProblem,
          allLabelPlacements,
          mergedLabelNetIdMap,
          paddingBuffer,
        })

        if (movedSecond) {
          outputTraces[secondCandidate.traceIndex] = movedSecond
          changed = true
          break
        }
      }

      if (changed) break
    }

    if (!changed) break
  }

  return outputTraces
}
