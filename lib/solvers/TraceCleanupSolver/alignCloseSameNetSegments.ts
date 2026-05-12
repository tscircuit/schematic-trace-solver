import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

type Segment = {
  trace: SolvedTracePath
  traceIndex: number
  segmentIndex: number
  p1: Point
  p2: Point
  orientation: "horizontal" | "vertical"
}

const DEFAULT_MAX_DISTANCE = 0.15
const MIN_OVERLAP = 0.01
const MAX_PASSES = 6

const isHorizontal = (p1: Point, p2: Point) => p1.y === p2.y && p1.x !== p2.x
const isVertical = (p1: Point, p2: Point) => p1.x === p2.x && p1.y !== p2.y

const getOverlap = (a1: number, a2: number, b1: number, b2: number) =>
  Math.min(Math.max(a1, a2), Math.max(b1, b2)) -
  Math.max(Math.min(a1, a2), Math.min(b1, b2))

const getInternalSegments = (
  trace: SolvedTracePath,
  traceIndex: number,
): Segment[] => {
  const segments: Segment[] = []
  const { tracePath } = trace

  for (let i = 1; i < tracePath.length - 2; i++) {
    const p1 = tracePath[i]
    const p2 = tracePath[i + 1]
    if (isHorizontal(p1, p2)) {
      segments.push({
        trace,
        traceIndex,
        segmentIndex: i,
        p1,
        p2,
        orientation: "horizontal",
      })
    } else if (isVertical(p1, p2)) {
      segments.push({
        trace,
        traceIndex,
        segmentIndex: i,
        p1,
        p2,
        orientation: "vertical",
      })
    }
  }

  return segments
}

const setSegmentAxis = (
  traces: SolvedTracePath[],
  segment: Segment,
  axisValue: number,
) => {
  const trace = traces[segment.traceIndex]
  const path = trace.tracePath.map((point) => ({ ...point }))
  const p1 = path[segment.segmentIndex]
  const p2 = path[segment.segmentIndex + 1]

  if (segment.orientation === "horizontal") {
    p1.y = axisValue
    p2.y = axisValue
  } else {
    p1.x = axisValue
    p2.x = axisValue
  }

  traces[segment.traceIndex] = {
    ...trace,
    tracePath: simplifyPath(path),
  }
}

export const alignCloseSameNetSegments = (
  traces: SolvedTracePath[],
  maxDistance = DEFAULT_MAX_DISTANCE,
): SolvedTracePath[] => {
  const output = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const segments = output.flatMap((trace, traceIndex) =>
      getInternalSegments(trace, traceIndex),
    )
    let changed = false

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i]
        const b = segments[j]
        if (a.traceIndex === b.traceIndex) continue
        if (a.trace.globalConnNetId !== b.trace.globalConnNetId) continue
        if (a.orientation !== b.orientation) continue

        if (a.orientation === "horizontal") {
          const distance = Math.abs(a.p1.y - b.p1.y)
          const overlap = getOverlap(a.p1.x, a.p2.x, b.p1.x, b.p2.x)
          if (
            distance === 0 ||
            distance > maxDistance ||
            overlap < MIN_OVERLAP
          ) {
            continue
          }
          const sharedY = (a.p1.y + b.p1.y) / 2
          setSegmentAxis(output, a, sharedY)
          setSegmentAxis(output, b, sharedY)
          changed = true
          break
        }

        const distance = Math.abs(a.p1.x - b.p1.x)
        const overlap = getOverlap(a.p1.y, a.p2.y, b.p1.y, b.p2.y)
        if (distance === 0 || distance > maxDistance || overlap < MIN_OVERLAP) {
          continue
        }
        const sharedX = (a.p1.x + b.p1.x) / 2
        setSegmentAxis(output, a, sharedX)
        setSegmentAxis(output, b, sharedX)
        changed = true
        break
      }
      if (changed) break
    }

    if (!changed) break
  }

  return output
}
