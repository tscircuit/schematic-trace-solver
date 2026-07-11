import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

type Axis = "x" | "y"

interface SegmentRef {
  traceIndex: number
  startIndex: number
  endIndex: number
  axis: Axis
  fixedCoord: number
  min: number
  max: number
}

const DEFAULT_MAX_AXIS_DISTANCE = 0.15
const DEFAULT_MIN_OVERLAP = 0.05
const EPSILON = 1e-6

const clonePoint = (point: Point): Point => ({ x: point.x, y: point.y })

const getSegmentRef = (
  traceIndex: number,
  startIndex: number,
  start: Point,
  end: Point,
): SegmentRef | null => {
  if (Math.abs(start.y - end.y) <= EPSILON) {
    return {
      traceIndex,
      startIndex,
      endIndex: startIndex + 1,
      axis: "y",
      fixedCoord: start.y,
      min: Math.min(start.x, end.x),
      max: Math.max(start.x, end.x),
    }
  }

  if (Math.abs(start.x - end.x) <= EPSILON) {
    return {
      traceIndex,
      startIndex,
      endIndex: startIndex + 1,
      axis: "x",
      fixedCoord: start.x,
      min: Math.min(start.y, end.y),
      max: Math.max(start.y, end.y),
    }
  }

  return null
}

const getMovableSegments = (traces: SolvedTracePath[]): SegmentRef[] => {
  const segments: SegmentRef[] = []

  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const tracePath = traces[traceIndex]!.tracePath
    for (let i = 0; i < tracePath.length - 1; i++) {
      if (i === 0 || i + 1 === tracePath.length - 1) continue

      const segment = getSegmentRef(
        traceIndex,
        i,
        tracePath[i]!,
        tracePath[i + 1]!,
      )
      if (segment) segments.push(segment)
    }
  }

  return segments
}

const getOverlapLength = (a: SegmentRef, b: SegmentRef): number => {
  return Math.min(a.max, b.max) - Math.max(a.min, b.min)
}

const getLength = (segment: SegmentRef): number => {
  return segment.max - segment.min
}

const snapSegment = (
  trace: SolvedTracePath,
  segment: SegmentRef,
  fixedCoord: number,
) => {
  const start = trace.tracePath[segment.startIndex]!
  const end = trace.tracePath[segment.endIndex]!

  if (segment.axis === "y") {
    start.y = fixedCoord
    end.y = fixedCoord
  } else {
    start.x = fixedCoord
    end.x = fixedCoord
  }
}

export function alignCloseSameNetTraceSegments(
  traces: SolvedTracePath[],
  {
    maxAxisDistance = DEFAULT_MAX_AXIS_DISTANCE,
    minOverlap = DEFAULT_MIN_OVERLAP,
    maxPasses = 8,
  }: {
    maxAxisDistance?: number
    minOverlap?: number
    maxPasses?: number
  } = {},
): SolvedTracePath[] {
  const output = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map(clonePoint),
  }))

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false
    const segments = getMovableSegments(output)

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i]!
        const b = segments[j]!
        const aTrace = output[a.traceIndex]!
        const bTrace = output[b.traceIndex]!

        if (aTrace.globalConnNetId !== bTrace.globalConnNetId) continue
        if (aTrace.mspPairId === bTrace.mspPairId) continue
        if (a.axis !== b.axis) continue
        if (Math.abs(a.fixedCoord - b.fixedCoord) > maxAxisDistance) continue
        if (getOverlapLength(a, b) < minOverlap) continue

        const target = getLength(a) >= getLength(b) ? a : b
        const movable = target === a ? b : a
        if (Math.abs(movable.fixedCoord - target.fixedCoord) <= EPSILON) {
          continue
        }

        snapSegment(output[movable.traceIndex]!, movable, target.fixedCoord)
        changed = true
      }
    }

    if (!changed) break
  }

  return output
}
