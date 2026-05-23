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

  // Two passes lets a segment align with the first close same-net neighbor, then
  // lets any newly simplified path expose another merge candidate.
  for (let pass = 0; pass < 2; pass++) {
    let changed = false

    for (let traceIndexA = 0; traceIndexA < output.length; traceIndexA++) {
      const traceA = output[traceIndexA]!
      for (
        let traceIndexB = traceIndexA + 1;
        traceIndexB < output.length;
        traceIndexB++
      ) {
        const traceB = output[traceIndexB]!
        if (getNetId(traceA) !== getNetId(traceB)) continue

        for (
          let segmentIndexA = 0;
          segmentIndexA < traceA.tracePath.length - 1;
          segmentIndexA++
        ) {
          if (!isInteriorSegment(traceA, segmentIndexA)) continue
          const segmentA = getSegmentRef(traceA, traceIndexA, segmentIndexA)
          if (!segmentA) continue

          for (
            let segmentIndexB = 0;
            segmentIndexB < traceB.tracePath.length - 1;
            segmentIndexB++
          ) {
            if (!isInteriorSegment(traceB, segmentIndexB)) continue
            const segmentB = getSegmentRef(traceB, traceIndexB, segmentIndexB)
            if (!segmentB) continue
            if (segmentA.orientation !== segmentB.orientation) continue
            if (!rangesOverlap(segmentA, segmentB)) continue

            const distance = Math.abs(segmentA.fixedCoord - segmentB.fixedCoord)
            if (distance <= EPS || distance > mergeDistance) continue

            const mergedCoord = (segmentA.fixedCoord + segmentB.fixedCoord) / 2
            output[traceIndexA] = moveSegmentToFixedCoord(
              output[traceIndexA]!,
              segmentIndexA,
              segmentA.orientation,
              mergedCoord,
            )
            output[traceIndexB] = moveSegmentToFixedCoord(
              output[traceIndexB]!,
              segmentIndexB,
              segmentB.orientation,
              mergedCoord,
            )
            changed = true
            break
          }

          if (changed) break
        }

        if (changed) break
      }

      if (changed) break
    }

    if (!changed) break
  }

  return output
}
