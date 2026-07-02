import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const DEFAULT_MERGE_DISTANCE = 0.18
const EPS = 1e-6

type Orientation = "horizontal" | "vertical"

type SegmentRef = {
  traceIndex: number
  startIndex: number
  orientation: Orientation
  fixedCoord: number
  min: number
  max: number
}

const getSegmentRef = (
  trace: SolvedTracePath,
  traceIndex: number,
  startIndex: number,
): SegmentRef | null => {
  const p1 = trace.tracePath[startIndex]!
  const p2 = trace.tracePath[startIndex + 1]!

  if (Math.abs(p1.y - p2.y) < EPS && Math.abs(p1.x - p2.x) > EPS) {
    return {
      traceIndex,
      startIndex,
      orientation: "horizontal",
      fixedCoord: p1.y,
      min: Math.min(p1.x, p2.x),
      max: Math.max(p1.x, p2.x),
    }
  }

  if (Math.abs(p1.x - p2.x) < EPS && Math.abs(p1.y - p2.y) > EPS) {
    return {
      traceIndex,
      startIndex,
      orientation: "vertical",
      fixedCoord: p1.x,
      min: Math.min(p1.y, p2.y),
      max: Math.max(p1.y, p2.y),
    }
  }

  return null
}

const getNetId = (trace: SolvedTracePath) =>
  trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId

const rangesOverlap = (a: SegmentRef, b: SegmentRef) =>
  Math.min(a.max, b.max) - Math.max(a.min, b.min) > EPS

const isInteriorSegment = (trace: SolvedTracePath, segmentStartIndex: number) =>
  segmentStartIndex > 0 && segmentStartIndex + 1 < trace.tracePath.length - 1

const moveSegmentToFixedCoord = (
  trace: SolvedTracePath,
  segmentStartIndex: number,
  orientation: Orientation,
  fixedCoord: number,
) => {
  const path = trace.tracePath.map((p) => ({ ...p }))
  const p1 = path[segmentStartIndex]!
  const p2 = path[segmentStartIndex + 1]!

  if (orientation === "horizontal") {
    path[segmentStartIndex] = { ...p1, y: fixedCoord }
    path[segmentStartIndex + 1] = { ...p2, y: fixedCoord }
  } else {
    path[segmentStartIndex] = { ...p1, x: fixedCoord }
    path[segmentStartIndex + 1] = { ...p2, x: fixedCoord }
  }

  return { ...trace, tracePath: simplifyPath(path as Point[]) }
}

export const mergeNearbySameNetSegments = (
  traces: SolvedTracePath[],
  mergeDistance = DEFAULT_MERGE_DISTANCE,
): SolvedTracePath[] => {
  let output = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((p) => ({ ...p })),
  }))

  const segments: SegmentRef[] = []
  for (let traceIndex = 0; traceIndex < output.length; traceIndex++) {
    const trace = output[traceIndex]!
    for (
      let segmentIndex = 0;
      segmentIndex < trace.tracePath.length - 1;
      segmentIndex++
    ) {
      if (!isInteriorSegment(trace, segmentIndex)) continue
      const segment = getSegmentRef(trace, traceIndex, segmentIndex)
      if (segment) segments.push(segment)
    }
  }

  const visited = new Set<number>()

  for (let startIndex = 0; startIndex < segments.length; startIndex++) {
    if (visited.has(startIndex)) continue

    const componentIndexes: number[] = []
    const queue = [startIndex]
    visited.add(startIndex)

    while (queue.length > 0) {
      const currentIndex = queue.shift()!
      const current = segments[currentIndex]!
      componentIndexes.push(currentIndex)

      for (
        let candidateIndex = 0;
        candidateIndex < segments.length;
        candidateIndex++
      ) {
        if (visited.has(candidateIndex)) continue
        const candidate = segments[candidateIndex]!
        if (
          getNetId(output[current.traceIndex]!) !==
          getNetId(output[candidate.traceIndex]!)
        )
          continue
        if (current.orientation !== candidate.orientation) continue
        if (!rangesOverlap(current, candidate)) continue

        const distance = Math.abs(current.fixedCoord - candidate.fixedCoord)
        if (distance <= EPS || distance > mergeDistance) continue

        visited.add(candidateIndex)
        queue.push(candidateIndex)
      }
    }

    if (componentIndexes.length < 2) continue

    const component = componentIndexes.map((index) => segments[index]!)
    const mergedCoord =
      component.reduce((sum, segment) => sum + segment.fixedCoord, 0) /
      component.length

    for (const segment of component) {
      output[segment.traceIndex] = moveSegmentToFixedCoord(
        output[segment.traceIndex]!,
        segment.startIndex,
        segment.orientation,
        mergedCoord,
      )
    }
  }

  return output
}
