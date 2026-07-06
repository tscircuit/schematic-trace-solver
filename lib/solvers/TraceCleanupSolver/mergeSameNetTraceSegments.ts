import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { ChipWithBounds } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { hasCollisions } from "./hasCollisions"
import { isSegmentAnEndpointSegment } from "./isSegmentAnEndpointSegment"
import { simplifyPath } from "./simplifyPath"

const SAME_AXIS_TOLERANCE = 0.2
const RANGE_GAP_TOLERANCE = 0.05
const TRACE_WIDTH = 0.01

type SegmentOrientation = "horizontal" | "vertical"

type ObstacleBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

interface TraceSegment {
  traceIndex: number
  segmentIndex: number
  orientation: SegmentOrientation
  axisValue: number
  rangeMin: number
  rangeMax: number
  globalConnNetId: string
}

interface AxisAdjustment {
  traceIndex: number
  pointIndex: number
  axis: "x" | "y"
  value: number
}

interface MergeSameNetTraceSegmentsOptions {
  staticObstacles?: ChipWithBounds[]
  allLabelPlacements?: NetLabelPlacement[]
  mergedLabelNetIdMap?: Record<string, Set<string>>
  paddingBuffer?: number
}

const rangesAreClose = (a: TraceSegment, b: TraceSegment) => {
  const overlap =
    Math.min(a.rangeMax, b.rangeMax) - Math.max(a.rangeMin, b.rangeMin)
  if (overlap >= 0) return true

  const gap =
    Math.max(a.rangeMin, b.rangeMin) - Math.min(a.rangeMax, b.rangeMax)
  return gap <= RANGE_GAP_TOLERANCE
}

const getTraceSegments = (traces: SolvedTracePath[]): TraceSegment[] => {
  const segments: TraceSegment[] = []

  for (const [traceIndex, trace] of traces.entries()) {
    for (
      let segmentIndex = 0;
      segmentIndex < trace.tracePath.length - 1;
      segmentIndex++
    ) {
      const p1 = trace.tracePath[segmentIndex]!
      const p2 = trace.tracePath[segmentIndex + 1]!

      if (isSegmentAnEndpointSegment(p1, p2, trace.tracePath)) continue

      if (isHorizontal(p1, p2)) {
        segments.push({
          traceIndex,
          segmentIndex,
          orientation: "horizontal",
          axisValue: p1.y,
          rangeMin: Math.min(p1.x, p2.x),
          rangeMax: Math.max(p1.x, p2.x),
          globalConnNetId: trace.globalConnNetId,
        })
      } else if (isVertical(p1, p2)) {
        segments.push({
          traceIndex,
          segmentIndex,
          orientation: "vertical",
          axisValue: p1.x,
          rangeMin: Math.min(p1.y, p2.y),
          rangeMax: Math.max(p1.y, p2.y),
          globalConnNetId: trace.globalConnNetId,
        })
      }
    }
  }

  return segments
}

const adjustedSegmentPath = (
  traces: SolvedTracePath[],
  segment: TraceSegment,
  axisValue: number,
): [Point, Point] => {
  const trace = traces[segment.traceIndex]!
  const p1 = trace.tracePath[segment.segmentIndex]!
  const p2 = trace.tracePath[segment.segmentIndex + 1]!

  if (segment.orientation === "horizontal") {
    return [
      { x: p1.x, y: axisValue },
      { x: p2.x, y: axisValue },
    ]
  }

  return [
    { x: axisValue, y: p1.y },
    { x: axisValue, y: p2.y },
  ]
}

const getTraceObstacleBounds = (
  traces: SolvedTracePath[],
  candidateNetId: string,
  excludedTraceIndexes: Set<number>,
): ObstacleBounds[] =>
  traces.flatMap((trace, traceIndex) => {
    if (excludedTraceIndexes.has(traceIndex)) return []
    if (trace.globalConnNetId === candidateNetId) return []

    return trace.tracePath.slice(0, -1).map((p1, segmentIndex) => {
      const p2 = trace.tracePath[segmentIndex + 1]!

      return {
        minX: Math.min(p1.x, p2.x) - TRACE_WIDTH / 2,
        minY: Math.min(p1.y, p2.y) - TRACE_WIDTH / 2,
        maxX: Math.max(p1.x, p2.x) + TRACE_WIDTH / 2,
        maxY: Math.max(p1.y, p2.y) + TRACE_WIDTH / 2,
      }
    })
  })

const isLabelAssociatedWithNet = (
  label: NetLabelPlacement,
  globalConnNetId: string,
  mergedLabelNetIdMap: Record<string, Set<string>>,
) => {
  const originalNetIds = mergedLabelNetIdMap[label.globalConnNetId]
  if (originalNetIds) return originalNetIds.has(globalConnNetId)

  return label.globalConnNetId === globalConnNetId
}

const getLabelObstacleBounds = (
  labels: NetLabelPlacement[],
  candidateNetId: string,
  mergedLabelNetIdMap: Record<string, Set<string>>,
  paddingBuffer: number,
): ObstacleBounds[] =>
  labels
    .filter(
      (label) =>
        !isLabelAssociatedWithNet(label, candidateNetId, mergedLabelNetIdMap),
    )
    .map((label) => ({
      minX: label.center.x - label.width / 2 - paddingBuffer,
      maxX: label.center.x + label.width / 2 + paddingBuffer,
      minY: label.center.y - label.height / 2 - paddingBuffer,
      maxY: label.center.y + label.height / 2 + paddingBuffer,
    }))

const canMergeSegmentsWithoutCollisions = (
  traces: SolvedTracePath[],
  a: TraceSegment,
  b: TraceSegment,
  mergedAxisValue: number,
  options: MergeSameNetTraceSegmentsOptions,
) => {
  const obstacles = [
    ...(options.staticObstacles ?? []),
    ...getTraceObstacleBounds(
      traces,
      a.globalConnNetId,
      new Set([a.traceIndex, b.traceIndex]),
    ),
    ...getLabelObstacleBounds(
      options.allLabelPlacements ?? [],
      a.globalConnNetId,
      options.mergedLabelNetIdMap ?? {},
      options.paddingBuffer ?? 0,
    ),
  ]

  if (obstacles.length === 0) return true

  return (
    !hasCollisions(
      adjustedSegmentPath(traces, a, mergedAxisValue),
      obstacles,
    ) &&
    !hasCollisions(adjustedSegmentPath(traces, b, mergedAxisValue), obstacles)
  )
}

const addAdjustment = (
  adjustments: AxisAdjustment[],
  segment: TraceSegment,
  value: number,
) => {
  const axis = segment.orientation === "horizontal" ? "y" : "x"
  adjustments.push(
    {
      traceIndex: segment.traceIndex,
      pointIndex: segment.segmentIndex,
      axis,
      value,
    },
    {
      traceIndex: segment.traceIndex,
      pointIndex: segment.segmentIndex + 1,
      axis,
      value,
    },
  )
}

const applyAdjustments = (
  traces: SolvedTracePath[],
  adjustments: AxisAdjustment[],
): SolvedTracePath[] => {
  const adjustmentMap = new Map<string, AxisAdjustment[]>()

  for (const adjustment of adjustments) {
    const key = `${adjustment.traceIndex}:${adjustment.pointIndex}:${adjustment.axis}`
    const list = adjustmentMap.get(key) ?? []
    list.push(adjustment)
    adjustmentMap.set(key, list)
  }

  return traces.map((trace, traceIndex) => {
    const tracePath = trace.tracePath.map((point, pointIndex): Point => {
      const xAdjustments =
        adjustmentMap.get(`${traceIndex}:${pointIndex}:x`) ?? []
      const yAdjustments =
        adjustmentMap.get(`${traceIndex}:${pointIndex}:y`) ?? []

      const avg = (values: AxisAdjustment[], fallback: number) =>
        values.length === 0
          ? fallback
          : values.reduce((sum, adjustment) => sum + adjustment.value, 0) /
            values.length

      return {
        x: avg(xAdjustments, point.x),
        y: avg(yAdjustments, point.y),
      }
    })

    return {
      ...trace,
      tracePath: simplifyPath(tracePath),
    }
  })
}

export const mergeSameNetTraceSegments = (
  traces: SolvedTracePath[],
  options: MergeSameNetTraceSegmentsOptions = {},
): SolvedTracePath[] => {
  const segments = getTraceSegments(traces)
  const adjustments: AxisAdjustment[] = []

  for (let i = 0; i < segments.length; i++) {
    const a = segments[i]!

    for (let j = i + 1; j < segments.length; j++) {
      const b = segments[j]!

      if (a.traceIndex === b.traceIndex) continue
      if (a.globalConnNetId !== b.globalConnNetId) continue
      if (a.orientation !== b.orientation) continue
      if (Math.abs(a.axisValue - b.axisValue) > SAME_AXIS_TOLERANCE) continue
      if (!rangesAreClose(a, b)) continue

      const mergedAxisValue = (a.axisValue + b.axisValue) / 2
      if (
        !canMergeSegmentsWithoutCollisions(
          traces,
          a,
          b,
          mergedAxisValue,
          options,
        )
      ) {
        continue
      }

      addAdjustment(adjustments, a, mergedAxisValue)
      addAdjustment(adjustments, b, mergedAxisValue)
    }
  }

  if (adjustments.length === 0) return traces

  return applyAdjustments(traces, adjustments)
}
