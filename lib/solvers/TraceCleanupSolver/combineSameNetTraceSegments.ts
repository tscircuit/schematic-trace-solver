import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { simplifyPath } from "./simplifyPath"

type Axis = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  segmentIndex: number
  axis: Axis
  fixedCoord: number
  min: number
  max: number
  length: number
}

type BlockingRect = {
  chipId: string
  minX: number
  maxX: number
  minY: number
  maxY: number
}

const EPS = 1e-6
const TRACE_WIDTH = 0.01
const MAX_PASSES = 50

const isHorizontalSegment = (p1: Point, p2: Point) =>
  Math.abs(p1.y - p2.y) < EPS

const isVerticalSegment = (p1: Point, p2: Point) => Math.abs(p1.x - p2.x) < EPS

const rangesOverlap = (a: SegmentRef, b: SegmentRef) =>
  Math.min(a.max, b.max) - Math.max(a.min, b.min) > EPS

const getInternalSegments = (traces: SolvedTracePath[]): Array<SegmentRef> => {
  const refs: Array<SegmentRef> = []

  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const tracePath = traces[traceIndex]!.tracePath
    for (
      let segmentIndex = 1;
      segmentIndex < tracePath.length - 2;
      segmentIndex++
    ) {
      const p1 = tracePath[segmentIndex]!
      const p2 = tracePath[segmentIndex + 1]!
      if (isHorizontalSegment(p1, p2)) {
        const min = Math.min(p1.x, p2.x)
        const max = Math.max(p1.x, p2.x)
        refs.push({
          traceIndex,
          segmentIndex,
          axis: "horizontal",
          fixedCoord: (p1.y + p2.y) / 2,
          min,
          max,
          length: max - min,
        })
      } else if (isVerticalSegment(p1, p2)) {
        const min = Math.min(p1.y, p2.y)
        const max = Math.max(p1.y, p2.y)
        refs.push({
          traceIndex,
          segmentIndex,
          axis: "vertical",
          fixedCoord: (p1.x + p2.x) / 2,
          min,
          max,
          length: max - min,
        })
      }
    }
  }

  return refs
}

const getAffectedSegments = (path: Point[], segmentIndex: number): Point[] => {
  const startIndex = Math.max(0, segmentIndex - 1)
  const endIndex = Math.min(path.length - 1, segmentIndex + 2)
  return path.slice(startIndex, endIndex + 1)
}

const moveSegmentToCoord = (
  trace: SolvedTracePath,
  segmentIndex: number,
  axis: Axis,
  targetCoord: number,
): Point[] => {
  const path = trace.tracePath.map((point) => ({ ...point }))
  if (axis === "horizontal") {
    path[segmentIndex]!.y = targetCoord
    path[segmentIndex + 1]!.y = targetCoord
  } else {
    path[segmentIndex]!.x = targetCoord
    path[segmentIndex + 1]!.x = targetCoord
  }
  return path
}

const segmentIntersectsAnyRect = (
  points: Point[],
  rects: BlockingRect[],
): boolean => {
  for (let i = 0; i < points.length - 1; i++) {
    for (const rect of rects) {
      if (segmentIntersectsRect(points[i]!, points[i + 1]!, rect)) {
        return true
      }
    }
  }
  return false
}

const getBlockingRects = ({
  traces,
  targetTrace,
  inputProblem,
  allLabelPlacements,
  mergedLabelNetIdMap,
}: {
  traces: SolvedTracePath[]
  targetTrace: SolvedTracePath
  inputProblem: InputProblem
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
}) => {
  const staticObstacles = getObstacleRects(inputProblem).map((obs) => ({
    ...obs,
    minX: obs.minX + EPS,
    maxX: obs.maxX - EPS,
    minY: obs.minY + EPS,
    maxY: obs.maxY - EPS,
  }))

  const traceObstacles = traces.flatMap((trace, traceIndex) => {
    if (trace.globalConnNetId === targetTrace.globalConnNetId) return []

    return trace.tracePath.slice(0, -1).map((p1, segmentIndex) => {
      const p2 = trace.tracePath[segmentIndex + 1]!
      return {
        chipId: `trace-obstacle-${traceIndex}-${segmentIndex}`,
        minX: Math.min(p1.x, p2.x) - TRACE_WIDTH / 2,
        minY: Math.min(p1.y, p2.y) - TRACE_WIDTH / 2,
        maxX: Math.max(p1.x, p2.x) + TRACE_WIDTH / 2,
        maxY: Math.max(p1.y, p2.y) + TRACE_WIDTH / 2,
      }
    })
  })

  const labelBounds = allLabelPlacements
    .filter((label) => {
      const originalNetIds = mergedLabelNetIdMap[label.globalConnNetId]
      if (originalNetIds) {
        return !originalNetIds.has(targetTrace.globalConnNetId)
      }
      return label.globalConnNetId !== targetTrace.globalConnNetId
    })
    .map((label) => ({
      chipId: `net-label-${label.globalConnNetId}`,
      minX: label.center.x - label.width / 2,
      maxX: label.center.x + label.width / 2,
      minY: label.center.y - label.height / 2,
      maxY: label.center.y + label.height / 2,
    }))

  return [...staticObstacles, ...traceObstacles, ...labelBounds]
}

const trySnapSegment = ({
  traces,
  fromSegment,
  toSegment,
  inputProblem,
  allLabelPlacements,
  mergedLabelNetIdMap,
}: {
  traces: SolvedTracePath[]
  fromSegment: SegmentRef
  toSegment: SegmentRef
  inputProblem: InputProblem
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
}): boolean => {
  const targetTrace = traces[fromSegment.traceIndex]!
  const candidatePath = moveSegmentToCoord(
    targetTrace,
    fromSegment.segmentIndex,
    fromSegment.axis,
    toSegment.fixedCoord,
  )

  const blockingRects = getBlockingRects({
    traces,
    targetTrace,
    inputProblem,
    allLabelPlacements,
    mergedLabelNetIdMap,
  })

  const affectedSegments = getAffectedSegments(
    candidatePath,
    fromSegment.segmentIndex,
  )
  if (segmentIntersectsAnyRect(affectedSegments, blockingRects)) {
    return false
  }

  traces[fromSegment.traceIndex] = {
    ...targetTrace,
    tracePath: simplifyPath(candidatePath),
  }
  return true
}

export const combineSameNetTraceSegments = ({
  traces,
  inputProblem,
  allLabelPlacements,
  mergedLabelNetIdMap,
  maxDistance,
}: {
  traces: SolvedTracePath[]
  inputProblem: InputProblem
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  maxDistance: number
}): SolvedTracePath[] => {
  const combinedTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const segments = getInternalSegments(combinedTraces)
    let changed = false

    for (let i = 0; i < segments.length; i++) {
      const segmentA = segments[i]!
      const traceA = combinedTraces[segmentA.traceIndex]!

      for (let j = i + 1; j < segments.length; j++) {
        const segmentB = segments[j]!
        const traceB = combinedTraces[segmentB.traceIndex]!

        if (traceA.globalConnNetId !== traceB.globalConnNetId) continue
        if (segmentA.axis !== segmentB.axis) continue
        if (!rangesOverlap(segmentA, segmentB)) continue

        const distance = Math.abs(segmentA.fixedCoord - segmentB.fixedCoord)
        if (distance <= EPS || distance > maxDistance) continue

        const [fromSegment, toSegment] =
          segmentA.length < segmentB.length
            ? [segmentA, segmentB]
            : [segmentB, segmentA]

        changed = trySnapSegment({
          traces: combinedTraces,
          fromSegment,
          toSegment,
          inputProblem,
          allLabelPlacements,
          mergedLabelNetIdMap,
        })

        if (changed) break
      }
      if (changed) break
    }

    if (!changed) break
  }

  return combinedTraces
}
