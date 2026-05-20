import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-9

interface SegmentRef {
  traceIndex: number
  segmentIndex: number
  orientation: "horizontal" | "vertical"
  length: number
  axis: number
  minAlong: number
  maxAlong: number
}

interface AlignNearbySameNetSegmentsOptions {
  maxAxisDistance?: number
  maxIterations?: number
}

const getSegmentRef = (
  trace: SolvedTracePath,
  traceIndex: number,
  segmentIndex: number,
): SegmentRef | null => {
  const p1 = trace.tracePath[segmentIndex]
  const p2 = trace.tracePath[segmentIndex + 1]
  if (!p1 || !p2) return null

  if (Math.abs(p1.y - p2.y) < EPS) {
    return {
      traceIndex,
      segmentIndex,
      orientation: "horizontal",
      length: Math.abs(p2.x - p1.x),
      axis: p1.y,
      minAlong: Math.min(p1.x, p2.x),
      maxAlong: Math.max(p1.x, p2.x),
    }
  }

  if (Math.abs(p1.x - p2.x) < EPS) {
    return {
      traceIndex,
      segmentIndex,
      orientation: "vertical",
      length: Math.abs(p2.y - p1.y),
      axis: p1.x,
      minAlong: Math.min(p1.y, p2.y),
      maxAlong: Math.max(p1.y, p2.y),
    }
  }

  return null
}

const getInternalSegments = (trace: SolvedTracePath, traceIndex: number) => {
  const segments: SegmentRef[] = []
  for (
    let segmentIndex = 1;
    segmentIndex < trace.tracePath.length - 2;
    segmentIndex++
  ) {
    const segment = getSegmentRef(trace, traceIndex, segmentIndex)
    if (segment && segment.length > EPS) {
      segments.push(segment)
    }
  }
  return segments
}

const rangesOverlap = (a: SegmentRef, b: SegmentRef) =>
  Math.min(a.maxAlong, b.maxAlong) - Math.max(a.minAlong, b.minAlong) > EPS

const pointsEqual = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

const collinearSegmentsOverlap = (
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
) => {
  const aHorizontal = Math.abs(a1.y - a2.y) < EPS
  const bHorizontal = Math.abs(b1.y - b2.y) < EPS
  const aVertical = Math.abs(a1.x - a2.x) < EPS
  const bVertical = Math.abs(b1.x - b2.x) < EPS

  if (aHorizontal && bHorizontal && Math.abs(a1.y - b1.y) < EPS) {
    return (
      Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) -
        Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x)) >
      EPS
    )
  }

  if (aVertical && bVertical && Math.abs(a1.x - b1.x) < EPS) {
    return (
      Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) -
        Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y)) >
      EPS
    )
  }

  return false
}

const segmentsCrossAtInterior = (
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
) => {
  const aHorizontal = Math.abs(a1.y - a2.y) < EPS
  const bHorizontal = Math.abs(b1.y - b2.y) < EPS
  const aVertical = Math.abs(a1.x - a2.x) < EPS
  const bVertical = Math.abs(b1.x - b2.x) < EPS

  if (!((aHorizontal && bVertical) || (aVertical && bHorizontal))) {
    return false
  }

  const horizontal = aHorizontal ? [a1, a2] : [b1, b2]
  const vertical = aVertical ? [a1, a2] : [b1, b2]
  const cross = { x: vertical[0].x, y: horizontal[0].y }

  const withinHorizontal =
    cross.x > Math.min(horizontal[0].x, horizontal[1].x) + EPS &&
    cross.x < Math.max(horizontal[0].x, horizontal[1].x) - EPS
  const withinVertical =
    cross.y > Math.min(vertical[0].y, vertical[1].y) + EPS &&
    cross.y < Math.max(vertical[0].y, vertical[1].y) - EPS

  if (!withinHorizontal || !withinVertical) return false

  return !(
    pointsEqual(cross, a1) ||
    pointsEqual(cross, a2) ||
    pointsEqual(cross, b1) ||
    pointsEqual(cross, b2)
  )
}

const wouldConflictWithDifferentNet = (
  candidatePath: Point[],
  candidateNetId: string,
  allTraces: SolvedTracePath[],
  candidateTraceIndex: number,
) => {
  for (
    let candidateSegmentIndex = 0;
    candidateSegmentIndex < candidatePath.length - 1;
    candidateSegmentIndex++
  ) {
    const c1 = candidatePath[candidateSegmentIndex]
    const c2 = candidatePath[candidateSegmentIndex + 1]
    if (!c1 || !c2) continue

    for (let traceIndex = 0; traceIndex < allTraces.length; traceIndex++) {
      if (traceIndex === candidateTraceIndex) continue

      const trace = allTraces[traceIndex]
      if (trace.globalConnNetId === candidateNetId) continue

      for (
        let segmentIndex = 0;
        segmentIndex < trace.tracePath.length - 1;
        segmentIndex++
      ) {
        const p1 = trace.tracePath[segmentIndex]
        const p2 = trace.tracePath[segmentIndex + 1]
        if (!p1 || !p2) continue

        if (
          collinearSegmentsOverlap(c1, c2, p1, p2) ||
          segmentsCrossAtInterior(c1, c2, p1, p2)
        ) {
          return true
        }
      }
    }
  }

  return false
}

const snapSegmentAxis = (
  trace: SolvedTracePath,
  segment: SegmentRef,
  axis: number,
): Point[] => {
  const nextPath = trace.tracePath.map((point) => ({ ...point }))
  if (segment.orientation === "horizontal") {
    nextPath[segment.segmentIndex]!.y = axis
    nextPath[segment.segmentIndex + 1]!.y = axis
  } else {
    nextPath[segment.segmentIndex]!.x = axis
    nextPath[segment.segmentIndex + 1]!.x = axis
  }
  return simplifyPath(nextPath)
}

export const alignNearbySameNetSegments = (
  traces: SolvedTracePath[],
  options: AlignNearbySameNetSegmentsOptions = {},
): SolvedTracePath[] => {
  const maxAxisDistance = options.maxAxisDistance ?? 0.15
  const maxIterations = options.maxIterations ?? 8
  let outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let changed = false
    const segmentsByTrace = outputTraces.map(getInternalSegments)

    for (let traceIndex = 0; traceIndex < outputTraces.length; traceIndex++) {
      for (
        let otherTraceIndex = traceIndex + 1;
        otherTraceIndex < outputTraces.length;
        otherTraceIndex++
      ) {
        const trace = outputTraces[traceIndex]
        const otherTrace = outputTraces[otherTraceIndex]
        if (trace.globalConnNetId !== otherTrace.globalConnNetId) continue

        for (const segment of segmentsByTrace[traceIndex]) {
          for (const otherSegment of segmentsByTrace[otherTraceIndex]) {
            if (segment.orientation !== otherSegment.orientation) continue
            if (!rangesOverlap(segment, otherSegment)) continue

            const axisDistance = Math.abs(segment.axis - otherSegment.axis)
            if (axisDistance < EPS || axisDistance > maxAxisDistance) continue

            const [sourceSegment, targetSegment] =
              segment.length >= otherSegment.length
                ? [segment, otherSegment]
                : [otherSegment, segment]
            const targetTrace = outputTraces[targetSegment.traceIndex]
            const candidatePath = snapSegmentAxis(
              targetTrace,
              targetSegment,
              sourceSegment.axis,
            )

            if (
              wouldConflictWithDifferentNet(
                candidatePath,
                targetTrace.globalConnNetId,
                outputTraces,
                targetSegment.traceIndex,
              )
            ) {
              continue
            }

            outputTraces = outputTraces.map((existingTrace, index) =>
              index === targetSegment.traceIndex
                ? { ...existingTrace, tracePath: candidatePath }
                : existingTrace,
            )
            changed = true
            break
          }
          if (changed) break
        }
        if (changed) break
      }
      if (changed) break
    }

    if (!changed) break
  }

  return outputTraces
}
