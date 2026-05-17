import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-6

type SegmentOrientation = "horizontal" | "vertical"

interface SegmentLocator {
  traceIndex: number
  segmentIndex: number
  orientation: SegmentOrientation
  coord: number
  spanMin: number
  spanMax: number
  length: number
  canMove: boolean
}

const getSegmentLocator = (
  trace: SolvedTracePath,
  traceIndex: number,
  segmentIndex: number,
): SegmentLocator | null => {
  const p1 = trace.tracePath[segmentIndex]
  const p2 = trace.tracePath[segmentIndex + 1]
  if (!p1 || !p2) return null

  const isHorizontal = Math.abs(p1.y - p2.y) < EPS
  const isVertical = Math.abs(p1.x - p2.x) < EPS
  if (!isHorizontal && !isVertical) return null

  if (isHorizontal) {
    const spanMin = Math.min(p1.x, p2.x)
    const spanMax = Math.max(p1.x, p2.x)
    if (spanMax - spanMin < EPS) return null
    return {
      traceIndex,
      segmentIndex,
      orientation: "horizontal",
      coord: p1.y,
      spanMin,
      spanMax,
      length: spanMax - spanMin,
      canMove: segmentIndex > 0 && segmentIndex < trace.tracePath.length - 2,
    }
  }

  const spanMin = Math.min(p1.y, p2.y)
  const spanMax = Math.max(p1.y, p2.y)
  if (spanMax - spanMin < EPS) return null
  return {
    traceIndex,
    segmentIndex,
    orientation: "vertical",
    coord: p1.x,
    spanMin,
    spanMax,
    length: spanMax - spanMin,
    canMove: segmentIndex > 0 && segmentIndex < trace.tracePath.length - 2,
  }
}

const getSegmentsByNet = (traces: SolvedTracePath[]) => {
  const segmentsByNet = new Map<string, SegmentLocator[]>()

  traces.forEach((trace, traceIndex) => {
    for (
      let segmentIndex = 0;
      segmentIndex < trace.tracePath.length - 1;
      segmentIndex++
    ) {
      const locator = getSegmentLocator(trace, traceIndex, segmentIndex)
      if (!locator) continue
      const existing = segmentsByNet.get(trace.globalConnNetId) ?? []
      existing.push(locator)
      segmentsByNet.set(trace.globalConnNetId, existing)
    }
  })

  return segmentsByNet
}

const getAllSegments = (traces: SolvedTracePath[]) =>
  traces.flatMap((trace, traceIndex) =>
    trace.tracePath.flatMap((_, segmentIndex) => {
      const locator = getSegmentLocator(trace, traceIndex, segmentIndex)
      return locator ? [locator] : []
    }),
  )

const spansOverlap = (a: SegmentLocator, b: SegmentLocator) =>
  Math.min(a.spanMax, b.spanMax) - Math.max(a.spanMin, b.spanMin) > EPS

const moveSegmentToCoord = (
  trace: SolvedTracePath,
  segmentIndex: number,
  orientation: SegmentOrientation,
  coord: number,
) => {
  const p1 = trace.tracePath[segmentIndex]!
  const p2 = trace.tracePath[segmentIndex + 1]!

  if (orientation === "horizontal") {
    p1.y = coord
    p2.y = coord
  } else {
    p1.x = coord
    p2.x = coord
  }

  trace.tracePath = simplifyPath(trace.tracePath)
}

const cloneAndMoveTrace = (
  trace: SolvedTracePath,
  segmentIndex: number,
  orientation: SegmentOrientation,
  coord: number,
): SolvedTracePath => {
  const clonedTrace = {
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }
  moveSegmentToCoord(clonedTrace, segmentIndex, orientation, coord)
  return clonedTrace
}

const wouldCreateDifferentNetOverlap = (
  traces: SolvedTracePath[],
  source: SegmentLocator,
  target: SegmentLocator,
) => {
  const movedTrace = cloneAndMoveTrace(
    traces[source.traceIndex]!,
    source.segmentIndex,
    source.orientation,
    target.coord,
  )
  const movedTraceSegments = getAllSegments([movedTrace])
  const otherNetSegments = getAllSegments(traces).filter(
    (segment) =>
      traces[segment.traceIndex]!.globalConnNetId !==
      movedTrace.globalConnNetId,
  )

  return movedTraceSegments.some((candidate) =>
    otherNetSegments.some(
      (other) =>
        candidate.orientation === other.orientation &&
        Math.abs(candidate.coord - other.coord) < EPS &&
        spansOverlap(candidate, other),
    ),
  )
}

const pickSourceAndTarget = (
  a: SegmentLocator,
  b: SegmentLocator,
): { source: SegmentLocator; target: SegmentLocator } | null => {
  if (!a.canMove && !b.canMove) return null
  if (a.canMove && !b.canMove) return { source: a, target: b }
  if (!a.canMove && b.canMove) return { source: b, target: a }

  // Move the shorter segment onto the longer one to preserve the dominant run.
  return a.length <= b.length
    ? { source: a, target: b }
    : { source: b, target: a }
}

/**
 * Aligns nearby overlapping segments that belong to the same global net.
 *
 * Endpoint segments are left in place so traces remain connected to their pins.
 * Internal segments can be moved onto a nearby same-net segment; adjacent
 * orthogonal segments stretch or shrink naturally because they share endpoints.
 */
export const mergeNearbySameNetTraceLines = (
  traces: SolvedTracePath[],
  maxDistance: number,
): SolvedTracePath[] => {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  let changed = true
  let passCount = 0
  const maxPasses = Math.max(1, outputTraces.length * 8)

  while (changed && passCount < maxPasses) {
    changed = false
    passCount++

    const segmentsByNet = getSegmentsByNet(outputTraces)

    for (const segments of segmentsByNet.values()) {
      for (let i = 0; i < segments.length; i++) {
        for (let j = i + 1; j < segments.length; j++) {
          const a = segments[i]!
          const b = segments[j]!
          if (
            a.traceIndex === b.traceIndex &&
            Math.abs(a.segmentIndex - b.segmentIndex) <= 1
          ) {
            continue
          }
          if (a.orientation !== b.orientation) continue
          if (Math.abs(a.coord - b.coord) < EPS) continue
          if (Math.abs(a.coord - b.coord) > maxDistance) continue
          if (!spansOverlap(a, b)) continue

          const pair = pickSourceAndTarget(a, b)
          if (!pair) continue
          if (
            wouldCreateDifferentNetOverlap(
              outputTraces,
              pair.source,
              pair.target,
            )
          ) {
            continue
          }

          moveSegmentToCoord(
            outputTraces[pair.source.traceIndex]!,
            pair.source.segmentIndex,
            pair.source.orientation,
            pair.target.coord,
          )
          changed = true
          break
        }
        if (changed) break
      }
      if (changed) break
    }
  }

  return outputTraces
}
