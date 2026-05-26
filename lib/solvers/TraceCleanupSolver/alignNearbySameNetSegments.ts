import type { Point } from "@tscircuit/math-utils"
import { doSegmentsIntersect } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

type SegmentInfo = {
  traceIndex: number
  pointIndex: number
  orientation: "horizontal" | "vertical"
  fixedCoord: number
  min: number
  max: number
  length: number
}

const EPS = 1e-6

const getSegmentInfo = (
  traceIndex: number,
  trace: SolvedTracePath,
  pointIndex: number,
): SegmentInfo | null => {
  const a = trace.tracePath[pointIndex]
  const b = trace.tracePath[pointIndex + 1]
  if (!a || !b) return null

  const isHorizontal = Math.abs(a.y - b.y) < EPS
  const isVertical = Math.abs(a.x - b.x) < EPS
  if (!isHorizontal && !isVertical) return null

  if (isHorizontal) {
    return {
      traceIndex,
      pointIndex,
      orientation: "horizontal",
      fixedCoord: a.y,
      min: Math.min(a.x, b.x),
      max: Math.max(a.x, b.x),
      length: Math.abs(a.x - b.x),
    }
  }

  return {
    traceIndex,
    pointIndex,
    orientation: "vertical",
    fixedCoord: a.x,
    min: Math.min(a.y, b.y),
    max: Math.max(a.y, b.y),
    length: Math.abs(a.y - b.y),
  }
}

const getInternalAxisAlignedSegments = (
  traces: SolvedTracePath[],
): SegmentInfo[] => {
  const segments: SegmentInfo[] = []

  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const trace = traces[traceIndex]!
    for (
      let pointIndex = 1;
      pointIndex < trace.tracePath.length - 2;
      pointIndex++
    ) {
      const segment = getSegmentInfo(traceIndex, trace, pointIndex)
      if (segment && segment.length > EPS) {
        segments.push(segment)
      }
    }
  }

  return segments
}

const rangesOverlap = (a: SegmentInfo, b: SegmentInfo): boolean =>
  Math.min(a.max, b.max) - Math.max(a.min, b.min) > EPS

const clonePath = (path: Point[]): Point[] => path.map((p) => ({ ...p }))

const isOrthogonalPath = (path: Point[]): boolean => {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    if (Math.abs(a.x - b.x) >= EPS && Math.abs(a.y - b.y) >= EPS) {
      return false
    }
  }
  return true
}

const moveSegmentToFixedCoord = (
  trace: SolvedTracePath,
  segment: SegmentInfo,
  fixedCoord: number,
): Point[] => {
  const path = clonePath(trace.tracePath)
  const a = path[segment.pointIndex]!
  const b = path[segment.pointIndex + 1]!

  if (segment.orientation === "horizontal") {
    a.y = fixedCoord
    b.y = fixedCoord
  } else {
    a.x = fixedCoord
    b.x = fixedCoord
  }

  return simplifyPath(path)
}

const intersectsDifferentNet = (
  candidateTrace: SolvedTracePath,
  allTraces: SolvedTracePath[],
): boolean => {
  for (let i = 0; i < candidateTrace.tracePath.length - 1; i++) {
    const a1 = candidateTrace.tracePath[i]!
    const a2 = candidateTrace.tracePath[i + 1]!

    for (const otherTrace of allTraces) {
      if (
        otherTrace.mspPairId === candidateTrace.mspPairId ||
        otherTrace.globalConnNetId === candidateTrace.globalConnNetId
      ) {
        continue
      }

      for (let j = 0; j < otherTrace.tracePath.length - 1; j++) {
        if (
          doSegmentsIntersect(
            a1,
            a2,
            otherTrace.tracePath[j]!,
            otherTrace.tracePath[j + 1]!,
          )
        ) {
          return true
        }
      }
    }
  }

  return false
}

export const alignNearbySameNetSegments = (
  traces: SolvedTracePath[],
  opts: { tolerance?: number; maxPasses?: number } = {},
): SolvedTracePath[] => {
  const tolerance = opts.tolerance ?? 0.15
  const maxPasses = opts.maxPasses ?? 8
  let output = traces.map((trace) => ({
    ...trace,
    tracePath: clonePath(trace.tracePath),
  }))

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false
    const segments = getInternalAxisAlignedSegments(output)

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i]!
        const b = segments[j]!
        const traceA = output[a.traceIndex]!
        const traceB = output[b.traceIndex]!

        if (traceA.mspPairId === traceB.mspPairId) continue
        if (traceA.globalConnNetId !== traceB.globalConnNetId) continue
        if (a.orientation !== b.orientation) continue
        if (!rangesOverlap(a, b)) continue

        const distance = Math.abs(a.fixedCoord - b.fixedCoord)
        if (distance < EPS || distance > tolerance) continue

        const [movingSegment, anchorSegment] =
          a.length <= b.length ? [a, b] : [b, a]
        const movingTrace = output[movingSegment.traceIndex]!
        const candidatePath = moveSegmentToFixedCoord(
          movingTrace,
          movingSegment,
          anchorSegment.fixedCoord,
        )

        if (!isOrthogonalPath(candidatePath)) continue

        const candidateTrace = {
          ...movingTrace,
          tracePath: candidatePath,
        }

        if (intersectsDifferentNet(candidateTrace, output)) continue

        output[movingSegment.traceIndex] = candidateTrace
        changed = true
        break
      }
      if (changed) break
    }

    if (!changed) break
  }

  return output
}
