import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-6
const DEFAULT_MERGE_DISTANCE = 0.15

type Orientation = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  fixedCoordinate: number
  rangeStart: number
  rangeEnd: number
}

const getSegmentRef = (
  traceIndex: number,
  segmentIndex: number,
  start: Point,
  end: Point,
): SegmentRef | null => {
  if (Math.abs(start.y - end.y) < EPS) {
    return {
      traceIndex,
      segmentIndex,
      orientation: "horizontal",
      fixedCoordinate: start.y,
      rangeStart: Math.min(start.x, end.x),
      rangeEnd: Math.max(start.x, end.x),
    }
  }

  if (Math.abs(start.x - end.x) < EPS) {
    return {
      traceIndex,
      segmentIndex,
      orientation: "vertical",
      fixedCoordinate: start.x,
      rangeStart: Math.min(start.y, end.y),
      rangeEnd: Math.max(start.y, end.y),
    }
  }

  return null
}

const getSegments = (
  traces: SolvedTracePath[],
  traceIndex: number,
  options: { includeTerminals: boolean },
): SegmentRef[] => {
  const trace = traces[traceIndex]!
  const refs: SegmentRef[] = []
  const startIndex = options.includeTerminals ? 0 : 1
  const endIndex = options.includeTerminals
    ? trace.tracePath.length - 1
    : trace.tracePath.length - 2

  for (let segmentIndex = startIndex; segmentIndex < endIndex; segmentIndex++) {
    const start = trace.tracePath[segmentIndex]!
    const end = trace.tracePath[segmentIndex + 1]!
    const ref = getSegmentRef(traceIndex, segmentIndex, start, end)
    if (ref) refs.push(ref)
  }

  return refs
}

const rangesOverlap = (a: SegmentRef, b: SegmentRef) =>
  Math.min(a.rangeEnd, b.rangeEnd) - Math.max(a.rangeStart, b.rangeStart) > EPS

const wouldOverlapDifferentNet = (
  traces: SolvedTracePath[],
  source: SegmentRef,
  fixedCoordinate: number,
) => {
  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const trace = traces[traceIndex]!
    if (trace.globalConnNetId === traces[source.traceIndex]!.globalConnNetId) {
      continue
    }

    for (
      let segmentIndex = 0;
      segmentIndex < trace.tracePath.length - 1;
      segmentIndex++
    ) {
      const ref = getSegmentRef(
        traceIndex,
        segmentIndex,
        trace.tracePath[segmentIndex]!,
        trace.tracePath[segmentIndex + 1]!,
      )
      if (!ref) continue
      if (ref.orientation !== source.orientation) continue
      if (Math.abs(ref.fixedCoordinate - fixedCoordinate) > EPS) continue
      if (rangesOverlap(source, ref)) return true
    }
  }

  return false
}

const snapSegmentFixedCoordinate = (
  trace: SolvedTracePath,
  segmentIndex: number,
  orientation: Orientation,
  fixedCoordinate: number,
) => {
  const tracePath = trace.tracePath.map((point) => ({ ...point }))
  const start = tracePath[segmentIndex]!
  const end = tracePath[segmentIndex + 1]!

  if (orientation === "horizontal") {
    start.y = fixedCoordinate
    end.y = fixedCoordinate
  } else {
    start.x = fixedCoordinate
    end.x = fixedCoordinate
  }

  return {
    ...trace,
    tracePath: simplifyPath(tracePath),
  }
}

export const mergeSameNetSegments = (
  traces: SolvedTracePath[],
  mergeDistance = DEFAULT_MERGE_DISTANCE,
): SolvedTracePath[] => {
  const mergedTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  const traceIndexesByNet = new Map<string, number[]>()
  for (let traceIndex = 0; traceIndex < mergedTraces.length; traceIndex++) {
    const netId = mergedTraces[traceIndex]!.globalConnNetId
    const traceIndexes = traceIndexesByNet.get(netId) ?? []
    traceIndexes.push(traceIndex)
    traceIndexesByNet.set(netId, traceIndexes)
  }

  for (const traceIndexes of traceIndexesByNet.values()) {
    if (traceIndexes.length < 2) continue

    let changed = true
    while (changed) {
      changed = false

      for (const traceIndex of traceIndexes.slice(1)) {
        const candidates = getSegments(mergedTraces, traceIndex, {
          includeTerminals: false,
        })

        for (const candidate of candidates) {
          const target = traceIndexes
            .filter((targetTraceIndex) => targetTraceIndex !== traceIndex)
            .flatMap((targetTraceIndex) =>
              getSegments(mergedTraces, targetTraceIndex, {
                includeTerminals: true,
              }),
            )
            .find(
              (other) =>
                other.orientation === candidate.orientation &&
                Math.abs(other.fixedCoordinate - candidate.fixedCoordinate) <=
                  mergeDistance &&
                Math.abs(other.fixedCoordinate - candidate.fixedCoordinate) >
                  EPS &&
                rangesOverlap(candidate, other) &&
                !wouldOverlapDifferentNet(
                  mergedTraces,
                  candidate,
                  other.fixedCoordinate,
                ),
            )

          if (!target) continue

          mergedTraces[traceIndex] = snapSegmentFixedCoordinate(
            mergedTraces[traceIndex]!,
            candidate.segmentIndex,
            candidate.orientation,
            target.fixedCoordinate,
          )
          changed = true
          break
        }

        if (changed) break
      }
    }
  }

  return mergedTraces
}
