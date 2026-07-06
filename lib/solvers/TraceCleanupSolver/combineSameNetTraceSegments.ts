import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

type SegmentOrientation = "horizontal" | "vertical"

interface SegmentLocator {
  traceIndex: number
  segmentIndex: number
  orientation: SegmentOrientation
  fixedCoord: number
  spanMin: number
  spanMax: number
  length: number
  isAnchored: boolean
}

const EPS = 1e-9

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  tracePath: trace.tracePath.map((point) => ({ ...point })),
})

const getTraceNetId = (trace: SolvedTracePath) =>
  trace.globalConnNetId ?? trace.userNetId ?? trace.dcConnNetId

const getSegments = (
  trace: SolvedTracePath,
  traceIndex: number,
): SegmentLocator[] => {
  const segments: SegmentLocator[] = []
  const { tracePath } = trace

  for (
    let segmentIndex = 0;
    segmentIndex < tracePath.length - 1;
    segmentIndex++
  ) {
    const start = tracePath[segmentIndex]!
    const end = tracePath[segmentIndex + 1]!
    const isHorizontal = Math.abs(start.y - end.y) < EPS
    const isVertical = Math.abs(start.x - end.x) < EPS

    if (!isHorizontal && !isVertical) continue

    const orientation = isHorizontal ? "horizontal" : "vertical"
    const fixedCoord = isHorizontal ? start.y : start.x
    const spanStart = isHorizontal ? start.x : start.y
    const spanEnd = isHorizontal ? end.x : end.y
    const spanMin = Math.min(spanStart, spanEnd)
    const spanMax = Math.max(spanStart, spanEnd)
    const length = spanMax - spanMin

    if (length < EPS) continue

    segments.push({
      traceIndex,
      segmentIndex,
      orientation,
      fixedCoord,
      spanMin,
      spanMax,
      length,
      isAnchored:
        segmentIndex === 0 || segmentIndex + 1 === tracePath.length - 1,
    })
  }

  return segments
}

const getSpanOverlap = (a: SegmentLocator, b: SegmentLocator) =>
  Math.min(a.spanMax, b.spanMax) - Math.max(a.spanMin, b.spanMin)

const chooseMove = (
  a: SegmentLocator,
  b: SegmentLocator,
): { movable: SegmentLocator; target: SegmentLocator } | null => {
  if (a.isAnchored && b.isAnchored) return null
  if (a.isAnchored) return { movable: b, target: a }
  if (b.isAnchored) return { movable: a, target: b }

  if (a.length >= b.length) {
    return { movable: b, target: a }
  }

  return { movable: a, target: b }
}

const moveSegmentToCoord = (
  trace: SolvedTracePath,
  segment: SegmentLocator,
  targetCoord: number,
) => {
  const path = trace.tracePath
  const start = path[segment.segmentIndex]!
  const end = path[segment.segmentIndex + 1]!

  if (segment.orientation === "horizontal") {
    start.y = targetCoord
    end.y = targetCoord
  } else {
    start.x = targetCoord
    end.x = targetCoord
  }

  trace.tracePath = simplifyPath(path)
}

export const combineSameNetTraceSegments = ({
  traces,
  maxDistance,
}: {
  traces: SolvedTracePath[]
  maxDistance: number
}): SolvedTracePath[] => {
  if (traces.length === 0 || maxDistance <= EPS) return traces

  const nextTraces = traces.map(cloneTrace)
  const maxPasses = Math.max(20, nextTraces.length * 20)

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false
    const traceIndexesByNet = new Map<string, number[]>()

    for (let traceIndex = 0; traceIndex < nextTraces.length; traceIndex++) {
      const trace = nextTraces[traceIndex]!
      const netId = getTraceNetId(trace)
      if (!netId) continue
      if (!traceIndexesByNet.has(netId)) traceIndexesByNet.set(netId, [])
      traceIndexesByNet.get(netId)!.push(traceIndex)
    }

    for (const traceIndexes of traceIndexesByNet.values()) {
      const segments = traceIndexes.flatMap((traceIndex) =>
        getSegments(nextTraces[traceIndex]!, traceIndex),
      )

      for (let i = 0; i < segments.length; i++) {
        const a = segments[i]!

        for (let j = i + 1; j < segments.length; j++) {
          const b = segments[j]!
          if (a.orientation !== b.orientation) continue
          if (Math.abs(a.fixedCoord - b.fixedCoord) > maxDistance) continue
          if (getSpanOverlap(a, b) <= EPS) continue

          const move = chooseMove(a, b)
          if (!move) continue
          if (
            Math.abs(move.movable.fixedCoord - move.target.fixedCoord) <= EPS
          ) {
            continue
          }

          moveSegmentToCoord(
            nextTraces[move.movable.traceIndex]!,
            move.movable,
            move.target.fixedCoord,
          )
          changed = true
          break
        }

        if (changed) break
      }

      if (changed) break
    }

    if (!changed) break
  }

  return nextTraces
}
