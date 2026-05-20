import { doSegmentsIntersect, type Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const DEFAULT_ALIGNMENT_THRESHOLD = 0.15
const EPSILON = 1e-9

type Orientation = "horizontal" | "vertical"

type SegmentRef = {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  fixedCoord: number
  minSpan: number
  maxSpan: number
  length: number
}

export const alignNearbySameNetSegments = (
  traces: SolvedTracePath[],
  opts: { alignmentThreshold?: number; maxPasses?: number } = {},
): SolvedTracePath[] => {
  const alignmentThreshold =
    opts.alignmentThreshold ?? DEFAULT_ALIGNMENT_THRESHOLD
  const maxPasses = opts.maxPasses ?? 6
  let outputTraces = cloneTraces(traces)

  for (let pass = 0; pass < maxPasses; pass++) {
    const alignedTraces = alignSinglePass(outputTraces, alignmentThreshold)
    if (!alignedTraces.changed) break
    outputTraces = alignedTraces.traces
  }

  return outputTraces
}

const alignSinglePass = (
  traces: SolvedTracePath[],
  alignmentThreshold: number,
): { traces: SolvedTracePath[]; changed: boolean } => {
  const tracesByNet = new Map<string, SolvedTracePath[]>()

  for (const trace of traces) {
    const netId = getTraceNetId(trace)
    if (!netId) continue
    const netTraces = tracesByNet.get(netId) ?? []
    netTraces.push(trace)
    tracesByNet.set(netId, netTraces)
  }

  for (const netTraces of tracesByNet.values()) {
    const segments = netTraces.flatMap((trace) =>
      getMovableSegments(traces.indexOf(trace), trace),
    )

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const first = segments[i]!
        const second = segments[j]!
        if (!canAlignSegments(first, second, alignmentThreshold)) continue

        const [target, movable] =
          first.length >= second.length ? [first, second] : [second, first]
        const candidateTrace = alignTraceSegment(
          traces[movable.traceIndex]!,
          movable,
          target.fixedCoord,
        )

        if (
          wouldCreateDifferentNetIntersection({
            originalTrace: traces[movable.traceIndex]!,
            candidateTrace,
            allTraces: traces,
          })
        ) {
          continue
        }

        const nextTraces = [...traces]
        nextTraces[movable.traceIndex] = candidateTrace
        return { traces: nextTraces, changed: true }
      }
    }
  }

  return { traces, changed: false }
}

const cloneTraces = (traces: SolvedTracePath[]): SolvedTracePath[] =>
  traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

const getTraceNetId = (trace: SolvedTracePath): string =>
  trace.globalConnNetId ?? trace.userNetId ?? trace.dcConnNetId ?? ""

const getMovableSegments = (
  traceIndex: number,
  trace: SolvedTracePath,
): SegmentRef[] => {
  const segments: SegmentRef[] = []

  for (
    let segmentIndex = 1;
    segmentIndex < trace.tracePath.length - 2;
    segmentIndex++
  ) {
    const start = trace.tracePath[segmentIndex]!
    const end = trace.tracePath[segmentIndex + 1]!
    const orientation = getSegmentOrientation(start, end)
    if (!orientation) continue

    const spanStart = orientation === "horizontal" ? start.x : start.y
    const spanEnd = orientation === "horizontal" ? end.x : end.y
    const fixedCoord = orientation === "horizontal" ? start.y : start.x

    segments.push({
      traceIndex,
      segmentIndex,
      orientation,
      fixedCoord,
      minSpan: Math.min(spanStart, spanEnd),
      maxSpan: Math.max(spanStart, spanEnd),
      length: Math.abs(spanEnd - spanStart),
    })
  }

  return segments
}

const getSegmentOrientation = (
  start: Point,
  end: Point,
): Orientation | null => {
  if (
    Math.abs(start.y - end.y) < EPSILON &&
    Math.abs(start.x - end.x) > EPSILON
  ) {
    return "horizontal"
  }
  if (
    Math.abs(start.x - end.x) < EPSILON &&
    Math.abs(start.y - end.y) > EPSILON
  ) {
    return "vertical"
  }
  return null
}

const canAlignSegments = (
  first: SegmentRef,
  second: SegmentRef,
  alignmentThreshold: number,
): boolean => {
  if (first.traceIndex === second.traceIndex) return false
  if (first.orientation !== second.orientation) return false

  const axisDistance = Math.abs(first.fixedCoord - second.fixedCoord)
  if (axisDistance < EPSILON || axisDistance > alignmentThreshold) return false

  return getSpanGap(first, second) <= alignmentThreshold
}

const getSpanGap = (first: SegmentRef, second: SegmentRef): number => {
  if (first.maxSpan < second.minSpan) return second.minSpan - first.maxSpan
  if (second.maxSpan < first.minSpan) return first.minSpan - second.maxSpan
  return 0
}

const alignTraceSegment = (
  trace: SolvedTracePath,
  segment: SegmentRef,
  targetCoord: number,
): SolvedTracePath => {
  const tracePath = trace.tracePath.map((point) => ({ ...point }))
  const start = tracePath[segment.segmentIndex]!
  const end = tracePath[segment.segmentIndex + 1]!

  if (segment.orientation === "horizontal") {
    start.y = targetCoord
    end.y = targetCoord
  } else {
    start.x = targetCoord
    end.x = targetCoord
  }

  return {
    ...trace,
    tracePath: simplifyPath(tracePath),
  }
}

const wouldCreateDifferentNetIntersection = ({
  originalTrace,
  candidateTrace,
  allTraces,
}: {
  originalTrace: SolvedTracePath
  candidateTrace: SolvedTracePath
  allTraces: SolvedTracePath[]
}): boolean => {
  const originalIntersections = getDifferentNetIntersectionKeys(
    originalTrace,
    allTraces,
  )
  const candidateIntersections = getDifferentNetIntersectionKeys(
    candidateTrace,
    allTraces,
  )

  for (const key of candidateIntersections) {
    if (!originalIntersections.has(key)) return true
  }

  return false
}

const getDifferentNetIntersectionKeys = (
  trace: SolvedTracePath,
  allTraces: SolvedTracePath[],
): Set<string> => {
  const intersections = new Set<string>()
  const traceNetId = getTraceNetId(trace)

  for (const otherTrace of allTraces) {
    if (otherTrace.mspPairId === trace.mspPairId) continue
    if (getTraceNetId(otherTrace) === traceNetId) continue

    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const start = trace.tracePath[i]!
      const end = trace.tracePath[i + 1]!

      for (let j = 0; j < otherTrace.tracePath.length - 1; j++) {
        const otherStart = otherTrace.tracePath[j]!
        const otherEnd = otherTrace.tracePath[j + 1]!

        if (doSegmentsIntersect(start, end, otherStart, otherEnd)) {
          intersections.add(`${otherTrace.mspPairId}:${j}`)
        }
      }
    }
  }

  return intersections
}
