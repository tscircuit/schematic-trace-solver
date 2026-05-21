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

type SegmentOrientation = "horizontal" | "vertical"

interface TraceSegment {
  traceIndex: number
  trace: SolvedTracePath
  segmentIndex: number
  p1: Point
  p2: Point
  orientation: SegmentOrientation
  axis: number
  min: number
  max: number
  length: number
}

interface AlignmentMove {
  moving: TraceSegment
  anchor: TraceSegment
  axisDistance: number
}

export interface AlignCloseSameNetSegmentsInput {
  traces: SolvedTracePath[]
  inputProblem?: InputProblem
  allLabelPlacements?: NetLabelPlacement[]
  mergedLabelNetIdMap?: Record<string, Set<string>>
  paddingBuffer?: number
  maxAlignmentDistance?: number
}

const EPS = 1e-6
const DEFAULT_MAX_ALIGNMENT_DISTANCE = 0.15
const MAX_ALIGNMENT_PASSES = 20

const getOrientation = (p1: Point, p2: Point): SegmentOrientation | null => {
  if (isHorizontal(p1, p2, EPS)) return "horizontal"
  if (isVertical(p1, p2, EPS)) return "vertical"
  return null
}

const isZeroLength = (p1: Point, p2: Point) =>
  Math.abs(p1.x - p2.x) < EPS && Math.abs(p1.y - p2.y) < EPS

const getSegmentLength = (
  p1: Point,
  p2: Point,
  orientation: SegmentOrientation,
) =>
  orientation === "horizontal" ? Math.abs(p2.x - p1.x) : Math.abs(p2.y - p1.y)

const getSegments = (
  traces: SolvedTracePath[],
  {
    internalOnly,
  }: {
    internalOnly: boolean
  },
): TraceSegment[] => {
  const segments: TraceSegment[] = []

  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const trace = traces[traceIndex]!
    const path = trace.tracePath

    for (let segmentIndex = 0; segmentIndex < path.length - 1; segmentIndex++) {
      if (
        internalOnly &&
        (segmentIndex === 0 || segmentIndex >= path.length - 2)
      ) {
        continue
      }

      const p1 = path[segmentIndex]!
      const p2 = path[segmentIndex + 1]!
      const orientation = getOrientation(p1, p2)

      if (!orientation || isZeroLength(p1, p2)) continue

      const min =
        orientation === "horizontal"
          ? Math.min(p1.x, p2.x)
          : Math.min(p1.y, p2.y)
      const max =
        orientation === "horizontal"
          ? Math.max(p1.x, p2.x)
          : Math.max(p1.y, p2.y)
      const axis = orientation === "horizontal" ? p1.y : p1.x
      const length = getSegmentLength(p1, p2, orientation)

      if (length <= EPS) continue

      segments.push({
        traceIndex,
        trace,
        segmentIndex,
        p1,
        p2,
        orientation,
        axis,
        min,
        max,
        length,
      })
    }
  }

  return segments
}

const projectionOverlap = (a: TraceSegment, b: TraceSegment) =>
  Math.min(a.max, b.max) - Math.max(a.min, b.min)

const areNetsEquivalent = (
  netA: string,
  netB: string,
  mergedLabelNetIdMap?: Record<string, Set<string>>,
) => {
  if (netA === netB) return true

  if (!mergedLabelNetIdMap) return false

  if (mergedLabelNetIdMap[netA]?.has(netB)) return true
  if (mergedLabelNetIdMap[netB]?.has(netA)) return true

  return Object.values(mergedLabelNetIdMap).some(
    (mergedNetIds) => mergedNetIds.has(netA) && mergedNetIds.has(netB),
  )
}

const chooseMoveDirection = (
  a: TraceSegment,
  b: TraceSegment,
): { moving: TraceSegment; anchor: TraceSegment } => {
  if (Math.abs(a.length - b.length) > EPS) {
    return a.length < b.length
      ? { moving: a, anchor: b }
      : { moving: b, anchor: a }
  }

  if (a.traceIndex !== b.traceIndex) {
    return a.traceIndex > b.traceIndex
      ? { moving: a, anchor: b }
      : { moving: b, anchor: a }
  }

  return a.segmentIndex > b.segmentIndex
    ? { moving: a, anchor: b }
    : { moving: b, anchor: a }
}

const getAlignmentMoves = ({
  traces,
  mergedLabelNetIdMap,
  maxAlignmentDistance,
}: {
  traces: SolvedTracePath[]
  mergedLabelNetIdMap?: Record<string, Set<string>>
  maxAlignmentDistance: number
}): AlignmentMove[] => {
  const segments = getSegments(traces, { internalOnly: true })
  const moves: AlignmentMove[] = []

  for (let i = 0; i < segments.length; i++) {
    const a = segments[i]!

    for (let j = i + 1; j < segments.length; j++) {
      const b = segments[j]!

      if (a.traceIndex === b.traceIndex) continue
      if (a.orientation !== b.orientation) continue
      if (
        !areNetsEquivalent(
          a.trace.globalConnNetId,
          b.trace.globalConnNetId,
          mergedLabelNetIdMap,
        )
      ) {
        continue
      }

      const axisDistance = Math.abs(a.axis - b.axis)
      if (axisDistance <= EPS || axisDistance > maxAlignmentDistance) continue
      if (projectionOverlap(a, b) <= EPS) continue

      const { moving, anchor } = chooseMoveDirection(a, b)
      moves.push({ moving, anchor, axisDistance })
    }
  }

  return moves.sort((a, b) => {
    if (Math.abs(a.axisDistance - b.axisDistance) > EPS) {
      return a.axisDistance - b.axisDistance
    }
    if (Math.abs(a.moving.length - b.moving.length) > EPS) {
      return a.moving.length - b.moving.length
    }
    if (a.moving.traceIndex !== b.moving.traceIndex) {
      return a.moving.traceIndex - b.moving.traceIndex
    }
    return a.moving.segmentIndex - b.moving.segmentIndex
  })
}

const moveSegmentToAxis = (
  path: Point[],
  segment: TraceSegment,
  targetAxis: number,
): { nextPath: Point[]; changedSegments: Array<[Point, Point]> } | null => {
  const nextPath = path.map((point) => ({ ...point }))
  const start = { ...nextPath[segment.segmentIndex]! }
  const end = { ...nextPath[segment.segmentIndex + 1]! }

  if (segment.orientation === "horizontal") {
    start.y = targetAxis
    end.y = targetAxis
  } else {
    start.x = targetAxis
    end.x = targetAxis
  }

  nextPath[segment.segmentIndex] = start
  nextPath[segment.segmentIndex + 1] = end

  const changedSegments: Array<[Point, Point]> = []

  if (segment.segmentIndex > 0) {
    changedSegments.push([nextPath[segment.segmentIndex - 1]!, start])
  }

  changedSegments.push([start, end])

  if (segment.segmentIndex + 2 < nextPath.length) {
    changedSegments.push([end, nextPath[segment.segmentIndex + 2]!])
  }

  const hasNonOrthogonalSegment = changedSegments.some(([p1, p2]) => {
    if (isZeroLength(p1, p2)) return false
    return !getOrientation(p1, p2)
  })

  if (hasNonOrthogonalSegment) return null

  return { nextPath, changedSegments }
}

const pointWithin = (value: number, min: number, max: number) =>
  value >= min - EPS && value <= max + EPS

const segmentsIntersect = (
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): boolean => {
  if (isZeroLength(a1, a2) || isZeroLength(b1, b2)) return false

  const aOrientation = getOrientation(a1, a2)
  const bOrientation = getOrientation(b1, b2)

  if (!aOrientation || !bOrientation) return false

  if (aOrientation === bOrientation) {
    if (aOrientation === "horizontal") {
      if (Math.abs(a1.y - b1.y) > EPS) return false
      return (
        Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) -
          Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x)) >
        EPS
      )
    }

    if (Math.abs(a1.x - b1.x) > EPS) return false
    return (
      Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) -
        Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y)) >
      EPS
    )
  }

  const horizontal =
    aOrientation === "horizontal" ? { p1: a1, p2: a2 } : { p1: b1, p2: b2 }
  const vertical =
    aOrientation === "vertical" ? { p1: a1, p2: a2 } : { p1: b1, p2: b2 }

  return (
    pointWithin(
      vertical.p1.x,
      Math.min(horizontal.p1.x, horizontal.p2.x),
      Math.max(horizontal.p1.x, horizontal.p2.x),
    ) &&
    pointWithin(
      horizontal.p1.y,
      Math.min(vertical.p1.y, vertical.p2.y),
      Math.max(vertical.p1.y, vertical.p2.y),
    )
  )
}

const segmentIntersectsAnyRect = (
  p1: Point,
  p2: Point,
  rects: Array<{ minX: number; minY: number; maxX: number; maxY: number }>,
) => {
  for (const rect of rects) {
    if (segmentIntersectsRect(p1, p2, { ...rect, chipId: "alignment-rect" })) {
      return true
    }
  }

  return false
}

const getDifferentNetLabelBounds = ({
  allLabelPlacements,
  movingNetId,
  mergedLabelNetIdMap,
}: {
  allLabelPlacements: NetLabelPlacement[]
  movingNetId: string
  mergedLabelNetIdMap?: Record<string, Set<string>>
}) =>
  allLabelPlacements
    .filter(
      (label) =>
        !areNetsEquivalent(
          label.globalConnNetId,
          movingNetId,
          mergedLabelNetIdMap,
        ),
    )
    .map((label) => ({
      minX: label.center.x - label.width / 2 + EPS,
      maxX: label.center.x + label.width / 2 - EPS,
      minY: label.center.y - label.height / 2 + EPS,
      maxY: label.center.y + label.height / 2 - EPS,
    }))

const isMoveSafe = ({
  changedSegments,
  movingTrace,
  traces,
  inputProblem,
  allLabelPlacements,
  mergedLabelNetIdMap,
}: {
  changedSegments: Array<[Point, Point]>
  movingTrace: SolvedTracePath
  traces: SolvedTracePath[]
  inputProblem?: InputProblem
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap?: Record<string, Set<string>>
}) => {
  const differentNetSegments = getSegments(traces, {
    internalOnly: false,
  }).filter(
    (segment) =>
      segment.trace.mspPairId !== movingTrace.mspPairId &&
      !areNetsEquivalent(
        segment.trace.globalConnNetId,
        movingTrace.globalConnNetId,
        mergedLabelNetIdMap,
      ),
  )

  const staticObstacles = inputProblem ? getObstacleRects(inputProblem) : []
  const labelBounds = getDifferentNetLabelBounds({
    allLabelPlacements,
    movingNetId: movingTrace.globalConnNetId,
    mergedLabelNetIdMap,
  })

  for (const [p1, p2] of changedSegments) {
    if (isZeroLength(p1, p2)) continue
    if (!getOrientation(p1, p2)) return false

    if (segmentIntersectsAnyRect(p1, p2, staticObstacles)) return false
    if (segmentIntersectsAnyRect(p1, p2, labelBounds)) return false

    for (const otherSegment of differentNetSegments) {
      if (segmentsIntersect(p1, p2, otherSegment.p1, otherSegment.p2)) {
        return false
      }
    }
  }

  return true
}

export const alignCloseSameNetSegments = ({
  traces,
  inputProblem,
  allLabelPlacements = [],
  mergedLabelNetIdMap,
  maxAlignmentDistance = DEFAULT_MAX_ALIGNMENT_DISTANCE,
}: AlignCloseSameNetSegmentsInput): SolvedTracePath[] => {
  let outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  for (let pass = 0; pass < MAX_ALIGNMENT_PASSES; pass++) {
    const moves = getAlignmentMoves({
      traces: outputTraces,
      mergedLabelNetIdMap,
      maxAlignmentDistance,
    })

    let appliedMove = false

    for (const move of moves) {
      const movingTrace = outputTraces[move.moving.traceIndex]!
      const movedPath = moveSegmentToAxis(
        movingTrace.tracePath,
        move.moving,
        move.anchor.axis,
      )

      if (!movedPath) continue

      if (
        !isMoveSafe({
          changedSegments: movedPath.changedSegments,
          movingTrace,
          traces: outputTraces,
          inputProblem,
          allLabelPlacements,
          mergedLabelNetIdMap,
        })
      ) {
        continue
      }

      outputTraces = outputTraces.map((trace, traceIndex) =>
        traceIndex === move.moving.traceIndex
          ? { ...trace, tracePath: simplifyPath(movedPath.nextPath) }
          : trace,
      )
      appliedMove = true
      break
    }

    if (!appliedMove) break
  }

  return outputTraces
}
