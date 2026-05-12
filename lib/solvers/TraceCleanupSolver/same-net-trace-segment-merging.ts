import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

type SegmentAxis = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  pointIndex: number
  axis: SegmentAxis
  constant: number
  min: number
  max: number
  netId: string
  movable: boolean
}

const EPSILON = 1e-9

export function mergeSameNetTraceSegments(
  traces: SolvedTracePath[],
  opts: { maxOffset?: number } = {},
): SolvedTracePath[] {
  const maxOffset = opts.maxOffset ?? 0.1
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  const segments = getMergeableSegments(outputTraces)

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i]!
      const b = segments[j]!

      if (a.netId !== b.netId || a.axis !== b.axis) continue
      if (!a.movable && !b.movable) continue
      if (Math.abs(a.constant - b.constant) > maxOffset) continue
      if (getRangeGap(a, b) > maxOffset) continue

      const mergedConstant =
        a.movable && b.movable
          ? (a.constant + b.constant) / 2
          : a.movable
            ? b.constant
            : a.constant

      if (a.movable) {
        moveSegment(outputTraces[a.traceIndex]!.tracePath, a, mergedConstant)
        a.constant = mergedConstant
      }
      if (b.movable) {
        moveSegment(outputTraces[b.traceIndex]!.tracePath, b, mergedConstant)
        b.constant = mergedConstant
      }
    }
  }

  return outputTraces
}

function getMergeableSegments(traces: SolvedTracePath[]): SegmentRef[] {
  const segments: SegmentRef[] = []

  traces.forEach((trace, traceIndex) => {
    const netId = trace.globalConnNetId ?? trace.userNetId ?? trace.dcConnNetId
    for (
      let pointIndex = 0;
      pointIndex < trace.tracePath.length - 1;
      pointIndex++
    ) {
      const start = trace.tracePath[pointIndex]!
      const end = trace.tracePath[pointIndex + 1]!
      const axis = getSegmentAxis(start, end)
      if (!axis) continue

      const movable =
        pointIndex > 0 && pointIndex + 1 < trace.tracePath.length - 1
      segments.push({
        traceIndex,
        pointIndex,
        axis,
        constant: axis === "horizontal" ? start.y : start.x,
        min:
          axis === "horizontal"
            ? Math.min(start.x, end.x)
            : Math.min(start.y, end.y),
        max:
          axis === "horizontal"
            ? Math.max(start.x, end.x)
            : Math.max(start.y, end.y),
        netId,
        movable,
      })
    }
  })

  return segments
}

function getSegmentAxis(start: Point, end: Point): SegmentAxis | null {
  if (Math.abs(start.y - end.y) < EPSILON) return "horizontal"
  if (Math.abs(start.x - end.x) < EPSILON) return "vertical"
  return null
}

function getRangeGap(a: SegmentRef, b: SegmentRef) {
  return Math.max(0, Math.max(a.min, b.min) - Math.min(a.max, b.max))
}

function moveSegment(
  tracePath: Point[],
  segment: SegmentRef,
  mergedConstant: number,
) {
  const start = tracePath[segment.pointIndex]!
  const end = tracePath[segment.pointIndex + 1]!
  if (segment.axis === "horizontal") {
    start.y = mergedConstant
    end.y = mergedConstant
  } else {
    start.x = mergedConstant
    end.x = mergedConstant
  }
}
