import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

type Orientation = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  startIndex: number
  orientation: Orientation
  fixedCoord: number
  min: number
  max: number
  length: number
}

const EPSILON = 1e-9

const getTraceNetId = (trace: SolvedTracePath) =>
  trace.globalConnNetId ||
  trace.dcConnNetId ||
  trace.userNetId ||
  trace.mspPairId

const getInternalAxisAlignedSegments = (
  trace: SolvedTracePath,
  traceIndex: number,
): SegmentRef[] => {
  const segments: SegmentRef[] = []

  for (let i = 1; i < trace.tracePath.length - 2; i++) {
    const p1 = trace.tracePath[i]!
    const p2 = trace.tracePath[i + 1]!
    const isHorizontal = Math.abs(p1.y - p2.y) < EPSILON
    const isVertical = Math.abs(p1.x - p2.x) < EPSILON

    if (isHorizontal && Math.abs(p1.x - p2.x) > EPSILON) {
      const min = Math.min(p1.x, p2.x)
      const max = Math.max(p1.x, p2.x)
      segments.push({
        traceIndex,
        startIndex: i,
        orientation: "horizontal",
        fixedCoord: p1.y,
        min,
        max,
        length: max - min,
      })
    } else if (isVertical && Math.abs(p1.y - p2.y) > EPSILON) {
      const min = Math.min(p1.y, p2.y)
      const max = Math.max(p1.y, p2.y)
      segments.push({
        traceIndex,
        startIndex: i,
        orientation: "vertical",
        fixedCoord: p1.x,
        min,
        max,
        length: max - min,
      })
    }
  }

  return segments
}

const projectionsOverlap = (a: SegmentRef, b: SegmentRef) =>
  Math.min(a.max, b.max) - Math.max(a.min, b.min) > EPSILON

const applySegmentCoord = (
  traces: SolvedTracePath[],
  segment: SegmentRef,
  fixedCoord: number,
) => {
  const tracePath = traces[segment.traceIndex]!.tracePath
  const p1 = tracePath[segment.startIndex]!
  const p2 = tracePath[segment.startIndex + 1]!

  if (segment.orientation === "horizontal") {
    p1.y = fixedCoord
    p2.y = fixedCoord
  } else {
    p1.x = fixedCoord
    p2.x = fixedCoord
  }
}

export const alignCloseSameNetTraceSegments = ({
  traces,
  mergeDistance = 0.12,
}: {
  traces: SolvedTracePath[]
  mergeDistance?: number
}): SolvedTracePath[] => {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))
  const segmentsByNet = new Map<string, SegmentRef[]>()

  for (let traceIndex = 0; traceIndex < outputTraces.length; traceIndex++) {
    const trace = outputTraces[traceIndex]!
    const netId = getTraceNetId(trace)
    const segments = getInternalAxisAlignedSegments(trace, traceIndex)
    const netSegments = segmentsByNet.get(netId) ?? []
    netSegments.push(...segments)
    segmentsByNet.set(netId, netSegments)
  }

  for (const segments of segmentsByNet.values()) {
    const visited = new Set<number>()

    for (let i = 0; i < segments.length; i++) {
      if (visited.has(i)) continue

      const component = [i]
      visited.add(i)

      for (let cursor = 0; cursor < component.length; cursor++) {
        const currentIndex = component[cursor]!
        const current = segments[currentIndex]!

        for (let j = 0; j < segments.length; j++) {
          if (visited.has(j)) continue
          const candidate = segments[j]!

          if (
            current.orientation === candidate.orientation &&
            Math.abs(current.fixedCoord - candidate.fixedCoord) <=
              mergeDistance &&
            projectionsOverlap(current, candidate)
          ) {
            visited.add(j)
            component.push(j)
          }
        }
      }

      if (component.length < 2) continue

      const target = component
        .map((index) => segments[index]!)
        .sort((a, b) => b.length - a.length)[0]!.fixedCoord

      for (const index of component) {
        applySegmentCoord(outputTraces, segments[index]!, target)
      }
    }
  }

  return outputTraces.map((trace) => ({
    ...trace,
    tracePath: simplifyPath(trace.tracePath),
  }))
}
