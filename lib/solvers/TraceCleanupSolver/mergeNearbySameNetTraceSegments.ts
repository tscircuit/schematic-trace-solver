import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { simplifyPath } from "./simplifyPath"

type Orientation = "horizontal" | "vertical"

interface MergeableSegment {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  fixedCoord: number
  rangeStart: number
  rangeEnd: number
  globalConnNetId: string
}

const DEFAULT_SNAP_DISTANCE = 0.1
const EPSILON = 1e-9

const clonePoint = (point: Point): Point => ({ x: point.x, y: point.y })

const getRangeGap = (a: MergeableSegment, b: MergeableSegment) =>
  Math.max(
    0,
    Math.max(a.rangeStart, b.rangeStart) - Math.min(a.rangeEnd, b.rangeEnd),
  )

const getMergeableSegments = (
  traces: SolvedTracePath[],
): MergeableSegment[] => {
  const segments: MergeableSegment[] = []

  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const trace = traces[traceIndex]!

    for (
      let segmentIndex = 1;
      segmentIndex < trace.tracePath.length - 2;
      segmentIndex++
    ) {
      const start = trace.tracePath[segmentIndex]!
      const end = trace.tracePath[segmentIndex + 1]!

      if (isHorizontal(start, end)) {
        segments.push({
          traceIndex,
          segmentIndex,
          orientation: "horizontal",
          fixedCoord: start.y,
          rangeStart: Math.min(start.x, end.x),
          rangeEnd: Math.max(start.x, end.x),
          globalConnNetId: trace.globalConnNetId,
        })
      } else if (isVertical(start, end)) {
        segments.push({
          traceIndex,
          segmentIndex,
          orientation: "vertical",
          fixedCoord: start.x,
          rangeStart: Math.min(start.y, end.y),
          rangeEnd: Math.max(start.y, end.y),
          globalConnNetId: trace.globalConnNetId,
        })
      }
    }
  }

  return segments
}

const snapSegment = (
  trace: SolvedTracePath,
  segmentIndex: number,
  orientation: Orientation,
  fixedCoord: number,
) => {
  const nextIndex = segmentIndex + 1
  const path = trace.tracePath.map(clonePoint)

  if (orientation === "horizontal") {
    path[segmentIndex] = { ...path[segmentIndex]!, y: fixedCoord }
    path[nextIndex] = { ...path[nextIndex]!, y: fixedCoord }
  } else {
    path[segmentIndex] = { ...path[segmentIndex]!, x: fixedCoord }
    path[nextIndex] = { ...path[nextIndex]!, x: fixedCoord }
  }

  return { ...trace, tracePath: simplifyPath(path) }
}

export const mergeNearbySameNetTraceSegments = (
  traces: SolvedTracePath[],
  opts: { snapDistance?: number } = {},
): { traces: SolvedTracePath[]; mergeCount: number } => {
  const snapDistance = opts.snapDistance ?? DEFAULT_SNAP_DISTANCE
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map(clonePoint),
  }))
  let mergeCount = 0

  for (let pass = 0; pass < 10; pass++) {
    const segments = getMergeableSegments(outputTraces)
    let changedThisPass = false

    for (let i = 0; i < segments.length; i++) {
      const a = segments[i]!
      for (let j = i + 1; j < segments.length; j++) {
        const b = segments[j]!

        if (a.traceIndex === b.traceIndex) continue
        if (a.globalConnNetId !== b.globalConnNetId) continue
        if (a.orientation !== b.orientation) continue
        if (Math.abs(a.fixedCoord - b.fixedCoord) <= EPSILON) continue
        if (Math.abs(a.fixedCoord - b.fixedCoord) > snapDistance + EPSILON)
          continue
        if (getRangeGap(a, b) > snapDistance + EPSILON) continue

        const targetCoord = (a.fixedCoord + b.fixedCoord) / 2
        outputTraces[a.traceIndex] = snapSegment(
          outputTraces[a.traceIndex]!,
          a.segmentIndex,
          a.orientation,
          targetCoord,
        )
        outputTraces[b.traceIndex] = snapSegment(
          outputTraces[b.traceIndex]!,
          b.segmentIndex,
          b.orientation,
          targetCoord,
        )
        mergeCount++
        changedThisPass = true
        break
      }
      if (changedThisPass) break
    }

    if (!changedThisPass) break
  }

  return { traces: outputTraces, mergeCount }
}
