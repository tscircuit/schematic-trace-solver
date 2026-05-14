import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const EPS = 1e-6

type Segment = {
  traceIndex: number
  segmentIndex: number
  orientation: "horizontal" | "vertical"
  fixedCoord: number
  rangeStart: number
  rangeEnd: number
}

const getSegment = (
  trace: SolvedTracePath,
  traceIndex: number,
  segmentIndex: number,
): Segment | null => {
  const p1 = trace.tracePath[segmentIndex]
  const p2 = trace.tracePath[segmentIndex + 1]
  if (!p1 || !p2) return null

  if (Math.abs(p1.y - p2.y) < EPS) {
    return {
      traceIndex,
      segmentIndex,
      orientation: "horizontal",
      fixedCoord: (p1.y + p2.y) / 2,
      rangeStart: Math.min(p1.x, p2.x),
      rangeEnd: Math.max(p1.x, p2.x),
    }
  }

  if (Math.abs(p1.x - p2.x) < EPS) {
    return {
      traceIndex,
      segmentIndex,
      orientation: "vertical",
      fixedCoord: (p1.x + p2.x) / 2,
      rangeStart: Math.min(p1.y, p2.y),
      rangeEnd: Math.max(p1.y, p2.y),
    }
  }

  return null
}

const rangesAreClose = (a: Segment, b: Segment, tolerance: number): boolean => {
  const gap =
    Math.max(a.rangeStart, b.rangeStart) - Math.min(a.rangeEnd, b.rangeEnd)
  return gap <= tolerance
}

const rangesOverlap = (a: Segment, b: Segment): boolean =>
  Math.max(a.rangeStart, b.rangeStart) <= Math.min(a.rangeEnd, b.rangeEnd) + EPS

const rangeContains = (segment: Segment, value: number): boolean =>
  value >= segment.rangeStart - EPS && value <= segment.rangeEnd + EPS

const segmentsIntersect = (a: Segment, b: Segment): boolean => {
  if (a.orientation === b.orientation) {
    return Math.abs(a.fixedCoord - b.fixedCoord) < EPS && rangesOverlap(a, b)
  }

  const horizontal = a.orientation === "horizontal" ? a : b
  const vertical = a.orientation === "vertical" ? a : b

  return (
    rangeContains(horizontal, vertical.fixedCoord) &&
    rangeContains(vertical, horizontal.fixedCoord)
  )
}

const isSafeToSnapSegment = (tracePath: Point[], segmentIndex: number) =>
  segmentIndex > 1 && segmentIndex < tracePath.length - 3

const snapSegment = (
  tracePath: Point[],
  segmentIndex: number,
  orientation: Segment["orientation"],
  fixedCoord: number,
) => {
  const p1 = tracePath[segmentIndex]!
  const p2 = tracePath[segmentIndex + 1]!

  if (orientation === "horizontal") {
    tracePath[segmentIndex] = { ...p1, y: fixedCoord }
    tracePath[segmentIndex + 1] = { ...p2, y: fixedCoord }
  } else {
    tracePath[segmentIndex] = { ...p1, x: fixedCoord }
    tracePath[segmentIndex + 1] = { ...p2, x: fixedCoord }
  }
}

const wouldIntersectDifferentNet = ({
  segment,
  traces,
  sourceNetId,
}: {
  segment: Segment
  traces: SolvedTracePath[]
  sourceNetId: string
}): boolean => {
  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const trace = traces[traceIndex]!
    if (trace.globalConnNetId === sourceNetId) continue

    for (
      let segmentIndex = 0;
      segmentIndex < trace.tracePath.length - 1;
      segmentIndex++
    ) {
      const otherSegment = getSegment(trace, traceIndex, segmentIndex)
      if (!otherSegment) continue
      if (segmentsIntersect(segment, otherSegment)) return true
    }
  }

  return false
}

export const mergeSameNetCloseSegments = ({
  traces,
  tolerance,
}: {
  traces: SolvedTracePath[]
  tolerance: number
}): SolvedTracePath[] => {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  const tracesByNet = new Map<string, number[]>()
  for (let traceIndex = 0; traceIndex < outputTraces.length; traceIndex++) {
    const trace = outputTraces[traceIndex]!
    const traceIndexes = tracesByNet.get(trace.globalConnNetId) ?? []
    traceIndexes.push(traceIndex)
    tracesByNet.set(trace.globalConnNetId, traceIndexes)
  }

  for (const traceIndexes of tracesByNet.values()) {
    for (let aIndex = 0; aIndex < traceIndexes.length; aIndex++) {
      for (let bIndex = aIndex + 1; bIndex < traceIndexes.length; bIndex++) {
        const traceAIndex = traceIndexes[aIndex]!
        const traceBIndex = traceIndexes[bIndex]!
        const traceA = outputTraces[traceAIndex]!
        const traceB = outputTraces[traceBIndex]!

        for (
          let segmentAIndex = 0;
          segmentAIndex < traceA.tracePath.length - 1;
          segmentAIndex++
        ) {
          if (!isSafeToSnapSegment(traceA.tracePath, segmentAIndex)) continue

          const segmentA = getSegment(traceA, traceAIndex, segmentAIndex)
          if (!segmentA) continue

          for (
            let segmentBIndex = 0;
            segmentBIndex < traceB.tracePath.length - 1;
            segmentBIndex++
          ) {
            if (!isSafeToSnapSegment(traceB.tracePath, segmentBIndex)) continue

            const segmentB = getSegment(traceB, traceBIndex, segmentBIndex)
            if (!segmentB || segmentA.orientation !== segmentB.orientation) {
              continue
            }

            const fixedCoordDiff = Math.abs(
              segmentA.fixedCoord - segmentB.fixedCoord,
            )
            if (
              fixedCoordDiff < EPS ||
              fixedCoordDiff > tolerance ||
              !rangesAreClose(segmentA, segmentB, tolerance)
            ) {
              continue
            }

            const mergedCoord = (segmentA.fixedCoord + segmentB.fixedCoord) / 2
            const snappedSegmentA = { ...segmentA, fixedCoord: mergedCoord }
            const snappedSegmentB = { ...segmentB, fixedCoord: mergedCoord }
            if (
              wouldIntersectDifferentNet({
                segment: snappedSegmentA,
                traces: outputTraces,
                sourceNetId: traceA.globalConnNetId,
              }) ||
              wouldIntersectDifferentNet({
                segment: snappedSegmentB,
                traces: outputTraces,
                sourceNetId: traceA.globalConnNetId,
              })
            ) {
              continue
            }

            snapSegment(
              outputTraces[segmentA.traceIndex]!.tracePath,
              segmentA.segmentIndex,
              segmentA.orientation,
              mergedCoord,
            )
            snapSegment(
              outputTraces[segmentB.traceIndex]!.tracePath,
              segmentB.segmentIndex,
              segmentB.orientation,
              mergedCoord,
            )
          }
        }
      }
    }
  }

  return outputTraces
}
