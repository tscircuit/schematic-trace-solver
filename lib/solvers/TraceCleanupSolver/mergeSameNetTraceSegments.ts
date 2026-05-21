import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

type SegmentOrientation = "horizontal" | "vertical"

interface TraceSegment {
  traceIndex: number
  pointIndex: number
  orientation: SegmentOrientation
  coord: number
  min: number
  max: number
  netKey: string
}

const getTraceNetKey = (trace: SolvedTracePath) =>
  trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId

const rangesOverlap = (
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
) => Math.min(aMax, bMax) >= Math.max(aMin, bMin)

const getInteriorOrthogonalSegments = (
  traces: SolvedTracePath[],
): TraceSegment[] => {
  const segments: TraceSegment[] = []

  traces.forEach((trace, traceIndex) => {
    const netKey = getTraceNetKey(trace)
    if (!netKey) return

    for (
      let pointIndex = 1;
      pointIndex < trace.tracePath.length - 2;
      pointIndex++
    ) {
      const p1 = trace.tracePath[pointIndex]!
      const p2 = trace.tracePath[pointIndex + 1]!

      if (isHorizontal(p1, p2)) {
        segments.push({
          traceIndex,
          pointIndex,
          orientation: "horizontal",
          coord: p1.y,
          min: Math.min(p1.x, p2.x),
          max: Math.max(p1.x, p2.x),
          netKey,
        })
      } else if (isVertical(p1, p2)) {
        segments.push({
          traceIndex,
          pointIndex,
          orientation: "vertical",
          coord: p1.x,
          min: Math.min(p1.y, p2.y),
          max: Math.max(p1.y, p2.y),
          netKey,
        })
      }
    }
  })

  return segments
}

const alignSegment = (
  tracePath: Point[],
  segment: TraceSegment,
  coord: number,
) => {
  const p1 = tracePath[segment.pointIndex]!
  const p2 = tracePath[segment.pointIndex + 1]!
  const nextP1 = Object.create(Object.getPrototypeOf(p1))
  Object.defineProperties(nextP1, Object.getOwnPropertyDescriptors(p1))
  const nextP2 = Object.create(Object.getPrototypeOf(p2))
  Object.defineProperties(nextP2, Object.getOwnPropertyDescriptors(p2))

  if (segment.orientation === "horizontal") {
    nextP1.y = coord
    nextP2.y = coord
  } else {
    nextP1.x = coord
    nextP2.x = coord
  }

  tracePath[segment.pointIndex] = nextP1
  tracePath[segment.pointIndex + 1] = nextP2
}

export const mergeSameNetTraceSegments = (
  traces: SolvedTracePath[],
  { tolerance = 0.12 }: { tolerance?: number } = {},
): SolvedTracePath[] => {
  const nextTraces = traces.slice()
  const mutableTraceIndexes = new Set<number>()

  const getMutableTracePath = (traceIndex: number) => {
    if (!mutableTraceIndexes.has(traceIndex)) {
      const trace = traces[traceIndex]!
      nextTraces[traceIndex] = {
        ...trace,
        tracePath: trace.tracePath.slice(),
      }
      mutableTraceIndexes.add(traceIndex)
    }

    return nextTraces[traceIndex]!.tracePath
  }

  const segments = getInteriorOrthogonalSegments(traces)

  for (let i = 0; i < segments.length; i++) {
    const anchor = segments[i]!

    for (let j = i + 1; j < segments.length; j++) {
      const candidate = segments[j]!
      if (anchor.netKey !== candidate.netKey) continue
      if (anchor.orientation !== candidate.orientation) continue
      if (Math.abs(anchor.coord - candidate.coord) > tolerance) continue
      if (
        !rangesOverlap(anchor.min, anchor.max, candidate.min, candidate.max)
      ) {
        continue
      }

      alignSegment(
        getMutableTracePath(candidate.traceIndex),
        candidate,
        anchor.coord,
      )
      candidate.coord = anchor.coord
    }
  }

  return nextTraces
}
