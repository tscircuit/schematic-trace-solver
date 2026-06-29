import type { Point } from "@tscircuit/math-utils"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { hasCollisions } from "./hasCollisions"
import { hasCollisionsWithLabels } from "./hasCollisionsWithLabels"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-6
const DEFAULT_ALIGNMENT_TOLERANCE = 0.15
const TRACE_WIDTH = 0.01
const STATIC_OBSTACLE_PADDING = 0.01

type SegmentOrientation = "horizontal" | "vertical"

interface SegmentInfo {
  traceIndex: number
  segmentIndex: number
  orientation: SegmentOrientation
  coord: number
  min: number
  max: number
  length: number
}

interface RectObstacle {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function alignNearbySameNetTraceSegments({
  traces,
  inputProblem,
  allLabelPlacements,
  mergedLabelNetIdMap,
  paddingBuffer,
  alignmentTolerance = DEFAULT_ALIGNMENT_TOLERANCE,
}: {
  traces: SolvedTracePath[]
  inputProblem: InputProblem
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
  alignmentTolerance?: number
}): SolvedTracePath[] {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: clonePath(trace.tracePath),
  }))

  const staticObstacles = getObstacleRects(inputProblem).map((obs) => ({
    ...obs,
    minX: obs.minX - STATIC_OBSTACLE_PADDING,
    minY: obs.minY - STATIC_OBSTACLE_PADDING,
    maxX: obs.maxX + STATIC_OBSTACLE_PADDING,
    maxY: obs.maxY + STATIC_OBSTACLE_PADDING,
  }))

  const netIds = Array.from(
    new Set(outputTraces.map((trace) => trace.globalConnNetId)),
  )

  for (const globalConnNetId of netIds) {
    alignSegmentsForNet({
      traces: outputTraces,
      globalConnNetId,
      orientation: "horizontal",
      staticObstacles,
      allLabelPlacements,
      mergedLabelNetIdMap,
      paddingBuffer,
      alignmentTolerance,
    })
    alignSegmentsForNet({
      traces: outputTraces,
      globalConnNetId,
      orientation: "vertical",
      staticObstacles,
      allLabelPlacements,
      mergedLabelNetIdMap,
      paddingBuffer,
      alignmentTolerance,
    })
  }

  return outputTraces
}

function alignSegmentsForNet({
  traces,
  globalConnNetId,
  orientation,
  staticObstacles,
  allLabelPlacements,
  mergedLabelNetIdMap,
  paddingBuffer,
  alignmentTolerance,
}: {
  traces: SolvedTracePath[]
  globalConnNetId: string
  orientation: SegmentOrientation
  staticObstacles: RectObstacle[]
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
  alignmentTolerance: number
}) {
  const visited = new Set<string>()
  const segments = collectSegments(traces, globalConnNetId, orientation).sort(
    (a, b) => b.length - a.length,
  )

  for (const anchor of segments) {
    const anchorKey = getSegmentKey(anchor)
    if (visited.has(anchorKey)) continue

    const group = segments.filter((candidate) => {
      const candidateKey = getSegmentKey(candidate)
      return (
        !visited.has(candidateKey) &&
        Math.abs(candidate.coord - anchor.coord) <= alignmentTolerance &&
        rangesAreClose(candidate, anchor, alignmentTolerance)
      )
    })

    if (group.length < 2) {
      visited.add(anchorKey)
      continue
    }

    if (
      tryApplyAlignment({
        traces,
        group,
        targetCoord: anchor.coord,
        staticObstacles,
        allLabelPlacements,
        mergedLabelNetIdMap,
        paddingBuffer,
      })
    ) {
      for (const segment of group) {
        visited.add(getSegmentKey(segment))
      }
    } else {
      visited.add(anchorKey)
    }
  }
}

function collectSegments(
  traces: SolvedTracePath[],
  globalConnNetId: string,
  orientation: SegmentOrientation,
): SegmentInfo[] {
  const segments: SegmentInfo[] = []

  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const trace = traces[traceIndex]!
    if (trace.globalConnNetId !== globalConnNetId) continue

    const path = trace.tracePath
    for (let segmentIndex = 0; segmentIndex < path.length - 1; segmentIndex++) {
      if (segmentIndex === 0 || segmentIndex === path.length - 2) continue

      const p1 = path[segmentIndex]!
      const p2 = path[segmentIndex + 1]!
      const isHorizontal = Math.abs(p1.y - p2.y) < EPS
      const isVertical = Math.abs(p1.x - p2.x) < EPS
      if (
        (orientation === "horizontal" && !isHorizontal) ||
        (orientation === "vertical" && !isVertical)
      ) {
        continue
      }

      const min =
        orientation === "horizontal"
          ? Math.min(p1.x, p2.x)
          : Math.min(p1.y, p2.y)
      const max =
        orientation === "horizontal"
          ? Math.max(p1.x, p2.x)
          : Math.max(p1.y, p2.y)
      const length = max - min
      if (length <= EPS) continue

      segments.push({
        traceIndex,
        segmentIndex,
        orientation,
        coord: orientation === "horizontal" ? p1.y : p1.x,
        min,
        max,
        length,
      })
    }
  }

  return segments
}

function tryApplyAlignment({
  traces,
  group,
  targetCoord,
  staticObstacles,
  allLabelPlacements,
  mergedLabelNetIdMap,
  paddingBuffer,
}: {
  traces: SolvedTracePath[]
  group: SegmentInfo[]
  targetCoord: number
  staticObstacles: RectObstacle[]
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
}): boolean {
  const touchedTraceIndexes = new Set(
    group.map((segment) => segment.traceIndex),
  )
  const candidateTraces = traces.map((trace, index) =>
    touchedTraceIndexes.has(index)
      ? { ...trace, tracePath: clonePath(trace.tracePath) }
      : trace,
  )
  const affectedSegmentsByTrace = new Map<number, Set<number>>()

  for (const segment of group) {
    const path = candidateTraces[segment.traceIndex]!.tracePath
    const p1 = path[segment.segmentIndex]!
    const p2 = path[segment.segmentIndex + 1]!

    if (segment.orientation === "horizontal") {
      p1.y = targetCoord
      p2.y = targetCoord
    } else {
      p1.x = targetCoord
      p2.x = targetCoord
    }

    const affectedSegments =
      affectedSegmentsByTrace.get(segment.traceIndex) ?? new Set<number>()
    for (const index of [
      segment.segmentIndex - 1,
      segment.segmentIndex,
      segment.segmentIndex + 1,
    ]) {
      if (index >= 0 && index < path.length - 1) {
        affectedSegments.add(index)
      }
    }
    affectedSegmentsByTrace.set(segment.traceIndex, affectedSegments)
  }

  for (const traceIndex of touchedTraceIndexes) {
    const trace = candidateTraces[traceIndex]!
    const obstacles = [
      ...staticObstacles,
      ...getOtherNetTraceObstacles(candidateTraces, trace),
    ]
    const labelBounds = getFilteredLabelBounds({
      trace,
      allLabelPlacements,
      mergedLabelNetIdMap,
      paddingBuffer,
    })

    for (const segmentIndex of affectedSegmentsByTrace.get(traceIndex) ?? []) {
      const segmentPath = [
        trace.tracePath[segmentIndex]!,
        trace.tracePath[segmentIndex + 1]!,
      ]
      if (
        hasCollisions(segmentPath, obstacles) ||
        hasCollisionsWithLabels(segmentPath, labelBounds)
      ) {
        return false
      }
    }
  }

  for (const traceIndex of touchedTraceIndexes) {
    traces[traceIndex] = {
      ...candidateTraces[traceIndex]!,
      tracePath: simplifyPath(candidateTraces[traceIndex]!.tracePath),
    }
  }

  return true
}

function getOtherNetTraceObstacles(
  traces: SolvedTracePath[],
  targetTrace: SolvedTracePath,
): RectObstacle[] {
  return traces
    .filter((trace) => trace.globalConnNetId !== targetTrace.globalConnNetId)
    .flatMap((trace, traceIndex) =>
      trace.tracePath.slice(0, -1).map((p1, segmentIndex) => {
        const p2 = trace.tracePath[segmentIndex + 1]!
        return {
          chipId: `trace-obstacle-${traceIndex}-${segmentIndex}`,
          minX: Math.min(p1.x, p2.x) - TRACE_WIDTH / 2,
          minY: Math.min(p1.y, p2.y) - TRACE_WIDTH / 2,
          maxX: Math.max(p1.x, p2.x) + TRACE_WIDTH / 2,
          maxY: Math.max(p1.y, p2.y) + TRACE_WIDTH / 2,
        }
      }),
    )
}

function getFilteredLabelBounds({
  trace,
  allLabelPlacements,
  mergedLabelNetIdMap,
  paddingBuffer,
}: {
  trace: SolvedTracePath
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
}): RectObstacle[] {
  return allLabelPlacements
    .filter((label) => {
      const originalNetIds = mergedLabelNetIdMap[label.globalConnNetId]
      if (originalNetIds) {
        return !originalNetIds.has(trace.globalConnNetId)
      }
      return label.globalConnNetId !== trace.globalConnNetId
    })
    .map((label) => ({
      minX: label.center.x - label.width / 2 - paddingBuffer,
      maxX: label.center.x + label.width / 2 + paddingBuffer,
      minY: label.center.y - label.height / 2 - paddingBuffer,
      maxY: label.center.y + label.height / 2 + paddingBuffer,
    }))
}

function rangesAreClose(
  a: Pick<SegmentInfo, "min" | "max">,
  b: Pick<SegmentInfo, "min" | "max">,
  tolerance: number,
) {
  return Math.min(a.max, b.max) >= Math.max(a.min, b.min) - tolerance
}

function getSegmentKey(segment: SegmentInfo) {
  return `${segment.traceIndex}:${segment.segmentIndex}`
}

function clonePath(path: Point[]): Point[] {
  return path.map((point) => ({ ...point }))
}
