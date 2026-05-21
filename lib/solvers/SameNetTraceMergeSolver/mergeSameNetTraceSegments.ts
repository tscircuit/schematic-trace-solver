import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"

type SegmentOrientation = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  startIndex: number
  orientation: SegmentOrientation
  fixedAxis: number
  min: number
  max: number
  length: number
  movable: boolean
}

export interface MergeSameNetTraceSegmentsOptions {
  axisTolerance?: number
  gapTolerance?: number
  maxPasses?: number
}

const EPS = 1e-6

const getNetKey = (trace: SolvedTracePath) =>
  trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId

const getOrientation = (p1: Point, p2: Point): SegmentOrientation | null => {
  if (Math.abs(p1.y - p2.y) < EPS && Math.abs(p1.x - p2.x) >= EPS) {
    return "horizontal"
  }
  if (Math.abs(p1.x - p2.x) < EPS && Math.abs(p1.y - p2.y) >= EPS) {
    return "vertical"
  }
  return null
}

const getSegmentRefs = (traces: SolvedTracePath[]): SegmentRef[] => {
  const segments: SegmentRef[] = []

  for (const [traceIndex, trace] of traces.entries()) {
    for (
      let startIndex = 0;
      startIndex < trace.tracePath.length - 1;
      startIndex++
    ) {
      const p1 = trace.tracePath[startIndex]!
      const p2 = trace.tracePath[startIndex + 1]!
      const orientation = getOrientation(p1, p2)
      if (!orientation) continue

      const horizontal = orientation === "horizontal"
      const a = horizontal ? p1.x : p1.y
      const b = horizontal ? p2.x : p2.y
      const fixedAxis = horizontal ? p1.y : p1.x

      segments.push({
        traceIndex,
        startIndex,
        orientation,
        fixedAxis,
        min: Math.min(a, b),
        max: Math.max(a, b),
        length: Math.abs(a - b),
        movable: startIndex > 0 && startIndex + 1 < trace.tracePath.length - 1,
      })
    }
  }

  return segments
}

const getIntervalGap = (a: SegmentRef, b: SegmentRef) => {
  if (a.max >= b.min && b.max >= a.min) return 0
  return Math.min(Math.abs(a.max - b.min), Math.abs(b.max - a.min))
}

const moveSegmentToAxis = (
  traces: SolvedTracePath[],
  segment: SegmentRef,
  targetAxis: number,
) => {
  const trace = traces[segment.traceIndex]!
  const p1 = trace.tracePath[segment.startIndex]!
  const p2 = trace.tracePath[segment.startIndex + 1]!

  if (segment.orientation === "horizontal") {
    p1.y = targetAxis
    p2.y = targetAxis
  } else {
    p1.x = targetAxis
    p2.x = targetAxis
  }
}

const getMovedSegment = (trace: SolvedTracePath, segment: SegmentRef) => {
  const p1 = { ...trace.tracePath[segment.startIndex]! }
  const p2 = { ...trace.tracePath[segment.startIndex + 1]! }

  if (segment.orientation === "horizontal") {
    p1.y = segment.fixedAxis
    p2.y = segment.fixedAxis
  } else {
    p1.x = segment.fixedAxis
    p2.x = segment.fixedAxis
  }

  return {
    ...segment,
    min:
      segment.orientation === "horizontal"
        ? Math.min(p1.x, p2.x)
        : Math.min(p1.y, p2.y),
    max:
      segment.orientation === "horizontal"
        ? Math.max(p1.x, p2.x)
        : Math.max(p1.y, p2.y),
  }
}

const rangesOverlap = (a: SegmentRef, b: SegmentRef) =>
  Math.min(a.max, b.max) - Math.max(a.min, b.min) > EPS

const segmentRefsCollide = (a: SegmentRef, b: SegmentRef) => {
  if (a.orientation === b.orientation) {
    return Math.abs(a.fixedAxis - b.fixedAxis) < EPS && rangesOverlap(a, b)
  }

  const horizontal = a.orientation === "horizontal" ? a : b
  const vertical = a.orientation === "vertical" ? a : b

  return (
    vertical.fixedAxis > horizontal.min + EPS &&
    vertical.fixedAxis < horizontal.max - EPS &&
    horizontal.fixedAxis > vertical.min + EPS &&
    horizontal.fixedAxis < vertical.max - EPS
  )
}

const canMoveSegmentToAxis = (
  traces: SolvedTracePath[],
  segment: SegmentRef,
  targetAxis: number,
) => {
  const trace = traces[segment.traceIndex]!
  const movedSegment = getMovedSegment(trace, {
    ...segment,
    fixedAxis: targetAxis,
  })
  const netKey = getNetKey(trace)

  for (const otherSegment of getSegmentRefs(traces)) {
    if (
      otherSegment.traceIndex === segment.traceIndex &&
      otherSegment.startIndex === segment.startIndex
    ) {
      continue
    }

    const otherTrace = traces[otherSegment.traceIndex]!
    if (getNetKey(otherTrace) === netKey) continue

    if (segmentRefsCollide(movedSegment, otherSegment)) {
      return false
    }
  }

  return true
}

export const mergeSameNetTraceSegments = (
  traces: SolvedTracePath[],
  opts: MergeSameNetTraceSegmentsOptions = {},
): { traces: SolvedTracePath[]; mergedSegmentCount: number } => {
  const axisTolerance = opts.axisTolerance ?? 0.1
  const gapTolerance = opts.gapTolerance ?? 0.2
  const maxPasses = opts.maxPasses ?? 4

  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  let mergedSegmentCount = 0

  for (let pass = 0; pass < maxPasses; pass++) {
    let changedThisPass = false
    const segments = getSegmentRefs(outputTraces)

    for (let i = 0; i < segments.length; i++) {
      const a = segments[i]!
      const traceA = outputTraces[a.traceIndex]!
      const netA = getNetKey(traceA)
      if (!netA) continue

      for (let j = i + 1; j < segments.length; j++) {
        const b = segments[j]!
        const traceB = outputTraces[b.traceIndex]!

        if (a.traceIndex === b.traceIndex) continue
        if (a.orientation !== b.orientation) continue
        if (netA !== getNetKey(traceB)) continue
        if (Math.abs(a.fixedAxis - b.fixedAxis) > axisTolerance) continue
        if (getIntervalGap(a, b) > gapTolerance) continue
        if (!a.movable && !b.movable) continue

        if (!a.movable) {
          if (!canMoveSegmentToAxis(outputTraces, b, a.fixedAxis)) continue
          moveSegmentToAxis(outputTraces, b, a.fixedAxis)
        } else if (!b.movable) {
          if (!canMoveSegmentToAxis(outputTraces, a, b.fixedAxis)) continue
          moveSegmentToAxis(outputTraces, a, b.fixedAxis)
        } else if (a.length === b.length) {
          const targetAxis = (a.fixedAxis + b.fixedAxis) / 2
          if (
            !canMoveSegmentToAxis(outputTraces, a, targetAxis) ||
            !canMoveSegmentToAxis(outputTraces, b, targetAxis)
          ) {
            continue
          }
          moveSegmentToAxis(outputTraces, a, targetAxis)
          moveSegmentToAxis(outputTraces, b, targetAxis)
        } else if (a.length > b.length) {
          if (!canMoveSegmentToAxis(outputTraces, b, a.fixedAxis)) continue
          moveSegmentToAxis(outputTraces, b, a.fixedAxis)
        } else {
          if (!canMoveSegmentToAxis(outputTraces, a, b.fixedAxis)) continue
          moveSegmentToAxis(outputTraces, a, b.fixedAxis)
        }

        mergedSegmentCount++
        changedThisPass = true
      }
    }

    for (const trace of outputTraces) {
      trace.tracePath = simplifyPath(trace.tracePath)
    }

    if (!changedThisPass) break
  }

  return { traces: outputTraces, mergedSegmentCount }
}
