import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
  segmentIntersectsRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-6
const DEFAULT_MAX_DISTANCE = 0.15
const MIN_OVERLAP = 0.05
const MAX_PASSES = 20

type SegmentInfo = {
  traceIndex: number
  pointIndex: number
  orientation: "h" | "v"
  fixedCoord: number
  start: number
  end: number
  length: number
}

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  tracePath: trace.tracePath.map((p) => ({ ...p })),
})

const getSegmentInfo = (
  trace: SolvedTracePath,
  traceIndex: number,
): SegmentInfo[] => {
  const segments: SegmentInfo[] = []

  for (let i = 1; i < trace.tracePath.length - 2; i++) {
    const a = trace.tracePath[i]!
    const b = trace.tracePath[i + 1]!

    if (isHorizontal(a, b)) {
      const start = Math.min(a.x, b.x)
      const end = Math.max(a.x, b.x)
      segments.push({
        traceIndex,
        pointIndex: i,
        orientation: "h",
        fixedCoord: a.y,
        start,
        end,
        length: end - start,
      })
    } else if (isVertical(a, b)) {
      const start = Math.min(a.y, b.y)
      const end = Math.max(a.y, b.y)
      segments.push({
        traceIndex,
        pointIndex: i,
        orientation: "v",
        fixedCoord: a.x,
        start,
        end,
        length: end - start,
      })
    }
  }

  return segments
}

const projectionOverlap = (a: SegmentInfo, b: SegmentInfo) =>
  Math.min(a.end, b.end) - Math.max(a.start, b.start)

const moveSegmentToFixedCoord = (
  trace: SolvedTracePath,
  segment: SegmentInfo,
  fixedCoord: number,
) => {
  const nextPath = trace.tracePath.map((p) => ({ ...p }))
  const a = nextPath[segment.pointIndex]!
  const b = nextPath[segment.pointIndex + 1]!

  if (segment.orientation === "h") {
    a.y = fixedCoord
    b.y = fixedCoord
  } else {
    a.x = fixedCoord
    b.x = fixedCoord
  }

  return {
    ...trace,
    tracePath: simplifyPath(nextPath),
  }
}

const segmentPairs = (path: Point[]) =>
  path.slice(0, -1).map((point, index) => [point, path[index + 1]!] as const)

const rangesTouch = (
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) => Math.min(aEnd, bEnd) >= Math.max(aStart, bStart) - EPS

const inRange = (value: number, start: number, end: number) =>
  value >= Math.min(start, end) - EPS && value <= Math.max(start, end) + EPS

const axisAlignedSegmentsTouch = (
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
) => {
  if (isHorizontal(a1, a2) && isHorizontal(b1, b2)) {
    return (
      Math.abs(a1.y - b1.y) <= EPS &&
      rangesTouch(
        Math.min(a1.x, a2.x),
        Math.max(a1.x, a2.x),
        Math.min(b1.x, b2.x),
        Math.max(b1.x, b2.x),
      )
    )
  }

  if (isVertical(a1, a2) && isVertical(b1, b2)) {
    return (
      Math.abs(a1.x - b1.x) <= EPS &&
      rangesTouch(
        Math.min(a1.y, a2.y),
        Math.max(a1.y, a2.y),
        Math.min(b1.y, b2.y),
        Math.max(b1.y, b2.y),
      )
    )
  }

  const h1 = isHorizontal(a1, a2)
    ? [a1, a2]
    : isHorizontal(b1, b2)
      ? [b1, b2]
      : null
  const v1 = isVertical(a1, a2)
    ? [a1, a2]
    : isVertical(b1, b2)
      ? [b1, b2]
      : null

  if (!h1 || !v1) return false

  const [hA, hB] = h1
  const [vA, vB] = v1

  return inRange(vA.x, hA.x, hB.x) && inRange(hA.y, vA.y, vB.y)
}

const isMoveSafe = (
  traces: SolvedTracePath[],
  movedTrace: SolvedTracePath,
  movedTraceIndex: number,
  inputProblem: InputProblem,
) => {
  const obstacles = getObstacleRects(inputProblem)

  for (const [a, b] of segmentPairs(movedTrace.tracePath)) {
    if (obstacles.some((rect) => segmentIntersectsRect(a, b, rect))) {
      return false
    }
  }

  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    if (traceIndex === movedTraceIndex) continue
    const otherTrace = traces[traceIndex]!
    if (otherTrace.globalConnNetId === movedTrace.globalConnNetId) continue

    for (const [a1, a2] of segmentPairs(movedTrace.tracePath)) {
      for (const [b1, b2] of segmentPairs(otherTrace.tracePath)) {
        if (axisAlignedSegmentsTouch(a1, a2, b1, b2)) {
          return false
        }
      }
    }
  }

  return true
}

export const alignNearbySameNetSegments = ({
  traces,
  inputProblem,
  maxDistance = DEFAULT_MAX_DISTANCE,
}: {
  traces: SolvedTracePath[]
  inputProblem: InputProblem
  maxDistance?: number
}): SolvedTracePath[] => {
  let outputTraces = traces.map(cloneTrace)

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false

    for (let i = 0; i < outputTraces.length; i++) {
      const trace = outputTraces[i]!
      const sameNetTraces = outputTraces
        .map((candidate, traceIndex) => ({ candidate, traceIndex }))
        .filter(
          ({ candidate, traceIndex }) =>
            traceIndex > i &&
            candidate.globalConnNetId === trace.globalConnNetId,
        )

      const traceSegments = getSegmentInfo(trace, i)

      for (const { candidate, traceIndex } of sameNetTraces) {
        const candidateSegments = getSegmentInfo(candidate, traceIndex)

        for (const a of traceSegments) {
          for (const b of candidateSegments) {
            if (a.orientation !== b.orientation) continue
            if (Math.abs(a.fixedCoord - b.fixedCoord) > maxDistance) continue
            if (projectionOverlap(a, b) < MIN_OVERLAP) continue

            const target = a.length >= b.length ? a : b
            const moving = target === a ? b : a
            const movedTrace = moveSegmentToFixedCoord(
              outputTraces[moving.traceIndex]!,
              moving,
              target.fixedCoord,
            )

            if (
              isMoveSafe(
                outputTraces,
                movedTrace,
                moving.traceIndex,
                inputProblem,
              )
            ) {
              outputTraces[moving.traceIndex] = movedTrace
              changed = true
            }
          }
        }
      }
    }

    if (!changed) break
  }

  return outputTraces
}
