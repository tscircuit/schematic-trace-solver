import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const EPSILON = 1e-9
const MAX_PASSES = 20

type SegmentOrientation = "horizontal" | "vertical"

interface TraceSegment {
  traceIndex: number
  pointIndex: number
  orientation: SegmentOrientation
  fixedCoord: number
  minCoord: number
  maxCoord: number
  length: number
  isTerminal: boolean
}

const getTraceNetKey = (trace: SolvedTracePath): string =>
  trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId

const getSegmentsForTrace = (
  trace: SolvedTracePath,
  traceIndex: number,
): TraceSegment[] => {
  const segments: TraceSegment[] = []

  for (
    let pointIndex = 0;
    pointIndex < trace.tracePath.length - 1;
    pointIndex++
  ) {
    const start = trace.tracePath[pointIndex]!
    const end = trace.tracePath[pointIndex + 1]!

    if (Math.abs(start.y - end.y) <= EPSILON) {
      const minCoord = Math.min(start.x, end.x)
      const maxCoord = Math.max(start.x, end.x)
      const length = maxCoord - minCoord
      if (length <= EPSILON) continue
      segments.push({
        traceIndex,
        pointIndex,
        orientation: "horizontal",
        fixedCoord: start.y,
        minCoord,
        maxCoord,
        length,
        isTerminal:
          pointIndex === 0 || pointIndex === trace.tracePath.length - 2,
      })
    } else if (Math.abs(start.x - end.x) <= EPSILON) {
      const minCoord = Math.min(start.y, end.y)
      const maxCoord = Math.max(start.y, end.y)
      const length = maxCoord - minCoord
      if (length <= EPSILON) continue
      segments.push({
        traceIndex,
        pointIndex,
        orientation: "vertical",
        fixedCoord: start.x,
        minCoord,
        maxCoord,
        length,
        isTerminal:
          pointIndex === 0 || pointIndex === trace.tracePath.length - 2,
      })
    }
  }

  return segments
}

const hasProjectionOverlap = (a: TraceSegment, b: TraceSegment): boolean => {
  const overlap =
    Math.min(a.maxCoord, b.maxCoord) - Math.max(a.minCoord, b.minCoord)
  return overlap > EPSILON
}

const shouldCombineSegments = (
  a: TraceSegment,
  b: TraceSegment,
  maxDistance: number,
): boolean => {
  if (a.traceIndex === b.traceIndex) return false
  if (a.orientation !== b.orientation) return false
  if (a.isTerminal || b.isTerminal) return false
  if (!hasProjectionOverlap(a, b)) return false

  const distance = Math.abs(a.fixedCoord - b.fixedCoord)
  return distance > EPSILON && distance <= maxDistance
}

const wouldOverlapDifferentNetSegment = (
  traces: SolvedTracePath[],
  target: TraceSegment,
  targetNetKey: string,
  fixedCoord: number,
): boolean => {
  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const trace = traces[traceIndex]!
    if (getTraceNetKey(trace) === targetNetKey) continue

    for (const segment of getSegmentsForTrace(trace, traceIndex)) {
      if (segment.orientation !== target.orientation) continue
      if (Math.abs(segment.fixedCoord - fixedCoord) > EPSILON) continue
      if (hasProjectionOverlap(segment, target)) return true
    }
  }

  return false
}

const snapSegmentFixedCoord = (
  trace: SolvedTracePath,
  segment: TraceSegment,
  fixedCoord: number,
): SolvedTracePath => {
  const tracePath = trace.tracePath.map((point) => ({ ...point }))
  const start = tracePath[segment.pointIndex]!
  const end = tracePath[segment.pointIndex + 1]!

  if (segment.orientation === "horizontal") {
    start.y = fixedCoord
    end.y = fixedCoord
  } else {
    start.x = fixedCoord
    end.x = fixedCoord
  }

  return {
    ...trace,
    tracePath: simplifyPath(tracePath as Point[]),
  }
}

export const combineCloseSameNetSegments = (
  traces: SolvedTracePath[],
  maxDistance = 0.1,
): SolvedTracePath[] => {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false

    const segments = outputTraces.flatMap((trace, traceIndex) =>
      getSegmentsForTrace(trace, traceIndex),
    )

    for (let i = 0; i < segments.length; i++) {
      const a = segments[i]!
      const traceA = outputTraces[a.traceIndex]!
      const netA = getTraceNetKey(traceA)

      for (let j = i + 1; j < segments.length; j++) {
        const b = segments[j]!
        const traceB = outputTraces[b.traceIndex]!

        if (netA !== getTraceNetKey(traceB)) continue
        if (!shouldCombineSegments(a, b, maxDistance)) continue

        const [anchor, target] = a.length >= b.length ? [a, b] : [b, a]
        if (
          wouldOverlapDifferentNetSegment(
            outputTraces,
            target,
            netA,
            anchor.fixedCoord,
          )
        ) {
          continue
        }
        outputTraces[target.traceIndex] = snapSegmentFixedCoord(
          outputTraces[target.traceIndex]!,
          target,
          anchor.fixedCoord,
        )
        changed = true
        break
      }

      if (changed) break
    }

    if (!changed) break
  }

  return outputTraces
}
