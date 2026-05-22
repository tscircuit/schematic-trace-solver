import type { Point } from "@tscircuit/math-utils"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { simplifyPath } from "./simplifyPath"

type Orientation = "horizontal" | "vertical"

interface TraceSegment {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  axis: number
  min: number
  max: number
  length: number
  globalConnNetId: string
}

interface BlockingRect {
  chipId: string
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const EPS = 1e-9

const getOrientation = (a: Point, b: Point): Orientation | null => {
  if (Math.abs(a.y - b.y) < EPS && Math.abs(a.x - b.x) > EPS) {
    return "horizontal"
  }
  if (Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) > EPS) {
    return "vertical"
  }
  return null
}

const getInternalSegments = (traces: SolvedTracePath[]): TraceSegment[] => {
  const segments: TraceSegment[] = []

  for (const [traceIndex, trace] of traces.entries()) {
    for (
      let segmentIndex = 1;
      segmentIndex < trace.tracePath.length - 2;
      segmentIndex++
    ) {
      const a = trace.tracePath[segmentIndex]!
      const b = trace.tracePath[segmentIndex + 1]!
      const orientation = getOrientation(a, b)
      if (!orientation) continue

      const min =
        orientation === "horizontal" ? Math.min(a.x, b.x) : Math.min(a.y, b.y)
      const max =
        orientation === "horizontal" ? Math.max(a.x, b.x) : Math.max(a.y, b.y)
      const length = max - min
      if (length < 0.02) continue

      segments.push({
        traceIndex,
        segmentIndex,
        orientation,
        axis: orientation === "horizontal" ? a.y : a.x,
        min,
        max,
        length,
        globalConnNetId: trace.globalConnNetId,
      })
    }
  }

  return segments
}

const projectionGap = (a: TraceSegment, b: TraceSegment) =>
  Math.max(0, Math.max(a.min, b.min) - Math.min(a.max, b.max))

const projectionOverlap = (a: TraceSegment, b: TraceSegment) =>
  Math.min(a.max, b.max) - Math.max(a.min, b.min)

const cloneTraces = (traces: SolvedTracePath[]): SolvedTracePath[] =>
  traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

const moveSegmentAxis = (
  trace: SolvedTracePath,
  segmentIndex: number,
  orientation: Orientation,
  axis: number,
): SolvedTracePath => {
  const nextPath = trace.tracePath.map((point) => ({ ...point }))
  const a = nextPath[segmentIndex]!
  const b = nextPath[segmentIndex + 1]!

  if (orientation === "horizontal") {
    a.y = axis
    b.y = axis
  } else {
    a.x = axis
    b.x = axis
  }

  return {
    ...trace,
    tracePath: simplifyPath(nextPath),
  }
}

const segmentsIntersect = (
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): boolean => {
  const aOrientation = getOrientation(a1, a2)
  const bOrientation = getOrientation(b1, b2)
  if (!aOrientation || !bOrientation) return false

  if (aOrientation === bOrientation) {
    if (aOrientation === "horizontal") {
      if (Math.abs(a1.y - b1.y) > EPS) return false
      return (
        Math.min(a2.x, a1.x) < Math.max(b1.x, b2.x) - EPS &&
        Math.min(b2.x, b1.x) < Math.max(a1.x, a2.x) - EPS
      )
    }

    if (Math.abs(a1.x - b1.x) > EPS) return false
    return (
      Math.min(a2.y, a1.y) < Math.max(b1.y, b2.y) - EPS &&
      Math.min(b2.y, b1.y) < Math.max(a1.y, a2.y) - EPS
    )
  }

  const horizontal =
    aOrientation === "horizontal" ? { a: a1, b: a2 } : { a: b1, b: b2 }
  const vertical =
    aOrientation === "vertical" ? { a: a1, b: a2 } : { a: b1, b: b2 }

  const minX = Math.min(horizontal.a.x, horizontal.b.x)
  const maxX = Math.max(horizontal.a.x, horizontal.b.x)
  const minY = Math.min(vertical.a.y, vertical.b.y)
  const maxY = Math.max(vertical.a.y, vertical.b.y)

  return (
    vertical.a.x > minX + EPS &&
    vertical.a.x < maxX - EPS &&
    horizontal.a.y > minY + EPS &&
    horizontal.a.y < maxY - EPS
  )
}

const pathHasDifferentNetCollision = (
  candidateTrace: SolvedTracePath,
  traces: SolvedTracePath[],
): boolean => {
  for (const otherTrace of traces) {
    if (otherTrace.mspPairId === candidateTrace.mspPairId) continue
    if (otherTrace.globalConnNetId === candidateTrace.globalConnNetId) continue

    for (let i = 0; i < candidateTrace.tracePath.length - 1; i++) {
      const a1 = candidateTrace.tracePath[i]!
      const a2 = candidateTrace.tracePath[i + 1]!
      for (let j = 0; j < otherTrace.tracePath.length - 1; j++) {
        if (
          segmentsIntersect(
            a1,
            a2,
            otherTrace.tracePath[j]!,
            otherTrace.tracePath[j + 1]!,
          )
        ) {
          return true
        }
      }
    }
  }

  return false
}

const pathIntersectsBlockingRects = (
  trace: SolvedTracePath,
  rects: BlockingRect[],
): boolean => {
  for (let i = 0; i < trace.tracePath.length - 1; i++) {
    const a = trace.tracePath[i]!
    const b = trace.tracePath[i + 1]!
    for (const rect of rects) {
      if (segmentIntersectsRect(a, b, rect)) return true
    }
  }

  return false
}

const getBlockingRects = ({
  inputProblem,
  allLabelPlacements = [],
  mergedLabelNetIdMap = {},
  targetNetId,
  paddingBuffer = 0,
}: {
  inputProblem?: InputProblem
  allLabelPlacements?: NetLabelPlacement[]
  mergedLabelNetIdMap?: Record<string, Set<string>>
  targetNetId: string
  paddingBuffer?: number
}): BlockingRect[] => {
  const staticRects = inputProblem ? getObstacleRects(inputProblem) : []

  const labelRects = allLabelPlacements
    .filter((label) => {
      const originalNetIds = mergedLabelNetIdMap[label.globalConnNetId]
      if (originalNetIds) return !originalNetIds.has(targetNetId)
      return label.globalConnNetId !== targetNetId
    })
    .map(
      (label): BlockingRect => ({
        chipId: `net-label-${label.globalConnNetId}`,
        minX: label.center.x - label.width / 2 - paddingBuffer,
        maxX: label.center.x + label.width / 2 + paddingBuffer,
        minY: label.center.y - label.height / 2 - paddingBuffer,
        maxY: label.center.y + label.height / 2 + paddingBuffer,
      }),
    )

  return [...staticRects, ...labelRects]
}

export const alignNearbySameNetTraceSegments = ({
  traces,
  inputProblem,
  allLabelPlacements,
  mergedLabelNetIdMap,
  paddingBuffer,
  maxAxisDistance = 0.12,
  maxProjectionGap = 0.12,
}: {
  traces: SolvedTracePath[]
  inputProblem?: InputProblem
  allLabelPlacements?: NetLabelPlacement[]
  mergedLabelNetIdMap?: Record<string, Set<string>>
  paddingBuffer?: number
  maxAxisDistance?: number
  maxProjectionGap?: number
}): SolvedTracePath[] => {
  const alignedTraces = cloneTraces(traces)

  for (let pass = 0; pass < 20; pass++) {
    const segments = getInternalSegments(alignedTraces)
    let changed = false

    for (let i = 0; i < segments.length; i++) {
      const a = segments[i]!
      for (let j = i + 1; j < segments.length; j++) {
        const b = segments[j]!
        if (a.traceIndex === b.traceIndex) continue
        if (a.globalConnNetId !== b.globalConnNetId) continue
        if (a.orientation !== b.orientation) continue
        if (Math.abs(a.axis - b.axis) > maxAxisDistance) continue
        if (
          projectionOverlap(a, b) <= EPS &&
          projectionGap(a, b) > maxProjectionGap
        ) {
          continue
        }

        const anchor = a.length >= b.length ? a : b
        const moving = anchor === a ? b : a
        if (Math.abs(anchor.axis - moving.axis) < EPS) continue

        const candidateTrace = moveSegmentAxis(
          alignedTraces[moving.traceIndex]!,
          moving.segmentIndex,
          moving.orientation,
          anchor.axis,
        )
        const candidateTraces = [...alignedTraces]
        candidateTraces[moving.traceIndex] = candidateTrace

        if (pathHasDifferentNetCollision(candidateTrace, candidateTraces)) {
          continue
        }

        const blockingRects = getBlockingRects({
          inputProblem,
          allLabelPlacements,
          mergedLabelNetIdMap,
          targetNetId: moving.globalConnNetId,
          paddingBuffer,
        })
        if (pathIntersectsBlockingRects(candidateTrace, blockingRects)) {
          continue
        }

        alignedTraces[moving.traceIndex] = candidateTrace
        changed = true
        break
      }
      if (changed) break
    }

    if (!changed) break
  }

  return alignedTraces
}
