import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { hasCollisions } from "./hasCollisions"
import { hasCollisionsWithLabels } from "./hasCollisionsWithLabels"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-6
const TRACE_WIDTH = 0.01
const DEFAULT_MAX_ALIGNMENT_DISTANCE = 0.075

type Axis = "horizontal" | "vertical"

interface Segment {
  traceIndex: number
  segmentIndex: number
  axis: Axis
  fixedCoord: number
  minCoord: number
  maxCoord: number
}

const isHorizontal = (a: Point, b: Point) => Math.abs(a.y - b.y) <= EPS
const isVertical = (a: Point, b: Point) => Math.abs(a.x - b.x) <= EPS

const getSegment = (
  traceIndex: number,
  segmentIndex: number,
  path: Point[],
): Segment | null => {
  const start = path[segmentIndex]
  const end = path[segmentIndex + 1]

  if (!start || !end) return null

  if (isHorizontal(start, end)) {
    return {
      traceIndex,
      segmentIndex,
      axis: "horizontal",
      fixedCoord: start.y,
      minCoord: Math.min(start.x, end.x),
      maxCoord: Math.max(start.x, end.x),
    }
  }

  if (isVertical(start, end)) {
    return {
      traceIndex,
      segmentIndex,
      axis: "vertical",
      fixedCoord: start.x,
      minCoord: Math.min(start.y, end.y),
      maxCoord: Math.max(start.y, end.y),
    }
  }

  return null
}

const getOverlapLength = (a: Segment, b: Segment) =>
  Math.min(a.maxCoord, b.maxCoord) - Math.max(a.minCoord, b.minCoord)

const getTraceObstacles = (
  traces: SolvedTracePath[],
  targetTrace: SolvedTracePath,
) =>
  traces
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

const getLabelBounds = ({
  labels,
  targetTrace,
  mergedLabelNetIdMap,
  paddingBuffer,
}: {
  labels: NetLabelPlacement[]
  targetTrace: SolvedTracePath
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
}) =>
  labels
    .filter((label) => {
      const originalNetIds = mergedLabelNetIdMap[label.globalConnNetId]
      if (originalNetIds) {
        return !originalNetIds.has(targetTrace.globalConnNetId)
      }
      return label.globalConnNetId !== targetTrace.globalConnNetId
    })
    .map((label) => ({
      minX: label.center.x - label.width / 2 - paddingBuffer,
      maxX: label.center.x + label.width / 2 + paddingBuffer,
      minY: label.center.y - label.height / 2 - paddingBuffer,
      maxY: label.center.y + label.height / 2 + paddingBuffer,
    }))

const canAlignPath = ({
  trace,
  path,
  traces,
  inputProblem,
  allLabelPlacements,
  mergedLabelNetIdMap,
  paddingBuffer,
}: {
  trace: SolvedTracePath
  path: Point[]
  traces: SolvedTracePath[]
  inputProblem: InputProblem
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
}) => {
  const obstacles = [
    ...getObstacleRects(inputProblem),
    ...getTraceObstacles(traces, trace),
  ]
  const labelBounds = getLabelBounds({
    labels: allLabelPlacements,
    targetTrace: trace,
    mergedLabelNetIdMap,
    paddingBuffer,
  })

  return (
    !hasCollisions(path, obstacles) &&
    !hasCollisionsWithLabels(path, labelBounds)
  )
}

const alignSegmentInPath = ({
  path,
  segment,
  fixedCoord,
}: {
  path: Point[]
  segment: Segment
  fixedCoord: number
}): Point[] => {
  const nextPath = path.map((point) => ({ ...point }))
  const start = nextPath[segment.segmentIndex]!
  const end = nextPath[segment.segmentIndex + 1]!

  if (segment.axis === "horizontal") {
    start.y = fixedCoord
    end.y = fixedCoord
  } else {
    start.x = fixedCoord
    end.x = fixedCoord
  }

  return simplifyPath(nextPath)
}

export const alignSameNetTraceSegments = ({
  traces,
  inputProblem,
  allLabelPlacements,
  mergedLabelNetIdMap,
  paddingBuffer,
  maxAlignmentDistance = DEFAULT_MAX_ALIGNMENT_DISTANCE,
}: {
  traces: SolvedTracePath[]
  inputProblem: InputProblem
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
  maxAlignmentDistance?: number
}): SolvedTracePath[] => {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  for (let traceIndex = 1; traceIndex < outputTraces.length; traceIndex++) {
    const trace = outputTraces[traceIndex]!

    for (
      let segmentIndex = 1;
      segmentIndex < trace.tracePath.length - 2;
      segmentIndex++
    ) {
      const movableSegment = getSegment(
        traceIndex,
        segmentIndex,
        trace.tracePath,
      )

      if (!movableSegment) continue

      let bestCandidate: Segment | null = null
      let bestOverlapLength = 0
      let bestDistance = Infinity

      for (
        let candidateTraceIndex = 0;
        candidateTraceIndex < traceIndex;
        candidateTraceIndex++
      ) {
        const candidateTrace = outputTraces[candidateTraceIndex]!
        if (candidateTrace.globalConnNetId !== trace.globalConnNetId) continue

        for (
          let candidateSegmentIndex = 0;
          candidateSegmentIndex < candidateTrace.tracePath.length - 1;
          candidateSegmentIndex++
        ) {
          const candidateSegment = getSegment(
            candidateTraceIndex,
            candidateSegmentIndex,
            candidateTrace.tracePath,
          )

          if (!candidateSegment) continue
          if (candidateSegment.axis !== movableSegment.axis) continue

          const distance = Math.abs(
            candidateSegment.fixedCoord - movableSegment.fixedCoord,
          )
          if (distance <= EPS || distance > maxAlignmentDistance) continue

          const overlapLength = getOverlapLength(
            movableSegment,
            candidateSegment,
          )
          if (overlapLength <= EPS) continue

          if (
            overlapLength > bestOverlapLength ||
            (Math.abs(overlapLength - bestOverlapLength) <= EPS &&
              distance < bestDistance)
          ) {
            bestCandidate = candidateSegment
            bestOverlapLength = overlapLength
            bestDistance = distance
          }
        }
      }

      if (!bestCandidate) continue

      const alignedPath = alignSegmentInPath({
        path: trace.tracePath,
        segment: movableSegment,
        fixedCoord: bestCandidate.fixedCoord,
      })

      const alignedTrace = { ...trace, tracePath: alignedPath }

      if (
        canAlignPath({
          trace: alignedTrace,
          path: alignedPath,
          traces: outputTraces,
          inputProblem,
          allLabelPlacements,
          mergedLabelNetIdMap,
          paddingBuffer,
        })
      ) {
        outputTraces[traceIndex] = alignedTrace
      }
    }
  }

  return outputTraces
}
