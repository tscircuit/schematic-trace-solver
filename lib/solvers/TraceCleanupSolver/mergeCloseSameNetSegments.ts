import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

type SegmentRef = {
  pathIndex: number
  segmentIndex: number
  orientation: "horizontal" | "vertical"
  coord: number
  rangeStart: number
  rangeEnd: number
}

const EPS = 1e-6
const DEFAULT_MERGE_DISTANCE = 0.12

const isHorizontal = (a: Point, b: Point) => Math.abs(a.y - b.y) < EPS
const isVertical = (a: Point, b: Point) => Math.abs(a.x - b.x) < EPS

const overlaps1D = (
  a1: number,
  a2: number,
  b1: number,
  b2: number,
  eps = EPS,
) => Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2)) > eps

const buildInternalSegmentRefs = (traces: SolvedTracePath[]): SegmentRef[] => {
  const refs: SegmentRef[] = []

  traces.forEach((trace, pathIndex) => {
    const pts = trace.tracePath
    for (let i = 1; i < pts.length - 2; i++) {
      const p1 = pts[i]!
      const p2 = pts[i + 1]!
      if (isHorizontal(p1, p2)) {
        refs.push({
          pathIndex,
          segmentIndex: i,
          orientation: "horizontal",
          coord: p1.y,
          rangeStart: Math.min(p1.x, p2.x),
          rangeEnd: Math.max(p1.x, p2.x),
        })
      } else if (isVertical(p1, p2)) {
        refs.push({
          pathIndex,
          segmentIndex: i,
          orientation: "vertical",
          coord: p1.x,
          rangeStart: Math.min(p1.y, p2.y),
          rangeEnd: Math.max(p1.y, p2.y),
        })
      }
    }
  })

  return refs
}

const shiftSegmentToCoord = (
  trace: SolvedTracePath,
  segmentIndex: number,
  orientation: "horizontal" | "vertical",
  targetCoord: number,
): SolvedTracePath => {
  const next = {
    ...trace,
    tracePath: trace.tracePath.map((p) => ({ ...p })),
  }

  const p1 = next.tracePath[segmentIndex]!
  const p2 = next.tracePath[segmentIndex + 1]!

  if (orientation === "horizontal") {
    p1.y = targetCoord
    p2.y = targetCoord
  } else {
    p1.x = targetCoord
    p2.x = targetCoord
  }

  next.tracePath = simplifyPath(next.tracePath)
  return next
}

export const mergeCloseSameNetSegments = (
  traces: SolvedTracePath[],
  opts?: { mergeDistance?: number; maxPasses?: number },
): SolvedTracePath[] => {
  const mergeDistance = opts?.mergeDistance ?? DEFAULT_MERGE_DISTANCE
  const maxPasses = opts?.maxPasses ?? 3

  let current = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((p) => ({ ...p })),
  }))

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false
    const refs = buildInternalSegmentRefs(current)

    outer: for (let i = 0; i < refs.length; i++) {
      for (let j = i + 1; j < refs.length; j++) {
        const a = refs[i]!
        const b = refs[j]!

        if (
          current[a.pathIndex]!.globalConnNetId !==
          current[b.pathIndex]!.globalConnNetId
        ) {
          continue
        }
        if (a.orientation !== b.orientation) continue
        if (a.pathIndex === b.pathIndex && a.segmentIndex === b.segmentIndex) continue
        if (!overlaps1D(a.rangeStart, a.rangeEnd, b.rangeStart, b.rangeEnd)) continue

        const distance = Math.abs(a.coord - b.coord)
        if (distance < EPS || distance > mergeDistance) continue

        const targetCoord = (a.coord + b.coord) / 2

        current[a.pathIndex] = shiftSegmentToCoord(
          current[a.pathIndex]!,
          a.segmentIndex,
          a.orientation,
          targetCoord,
        )
        current[b.pathIndex] = shiftSegmentToCoord(
          current[b.pathIndex]!,
          b.segmentIndex,
          b.orientation,
          targetCoord,
        )

        changed = true
        break outer
      }
    }

    if (!changed) break
  }

  return current
}
