import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { simplifyPath } from "./simplifyPath"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const EPS = 1e-5

interface HSegment {
  orient: "H"
  y: number
  xMin: number
  xMax: number
  traceIdx: number
  segStart: number
}

interface VSegment {
  orient: "V"
  x: number
  yMin: number
  yMax: number
  traceIdx: number
  segStart: number
}

type Segment = HSegment | VSegment

const snapHorizontalSegment = (path: Point[], segStart: number, y: number) => {
  path[segStart] = { ...path[segStart], y }
  path[segStart + 1] = { ...path[segStart + 1], y }
}

const snapVerticalSegment = (path: Point[], segStart: number, x: number) => {
  path[segStart] = { ...path[segStart], x }
  path[segStart + 1] = { ...path[segStart + 1], x }
}

/**
 * Collapse parallel same-net trace segments that sit close together onto a
 * single shared coordinate.
 *
 * After the SchematicTraceLinesSolver + TraceOverlapShiftSolver pipeline,
 * two traces belonging to the same electrical net can end up running
 * parallel at a small offset — visually this reads as two near-overlapping
 * wires instead of a single trunk. Since the traces are electrically the
 * same net, merging them onto a shared X or Y removes the visual
 * duplication without changing connectivity.
 *
 * Algorithm:
 *   1. Group traces by `dcConnNetId` (the direct-connection net id).
 *   2. Enumerate every axis-aligned segment in each group.
 *   3. For each pair of co-net same-orientation segments that
 *        (a) have a perpendicular offset > EPS but ≤ threshold, and
 *        (b) overlap in their parallel axis,
 *      snap both segments to the midpoint between them.
 *   4. Pass each resulting path through simplifyPath() to collapse
 *      collinear/duplicate corners produced by the snap.
 *
 * Endpoint corners (path[0] and path[length-1]) are never moved — those
 * touch chip pins and shifting them would disconnect the trace.
 *
 * @param traces          all SolvedTracePaths in the schematic
 * @param paddingBuffer   the upstream channel-spacing constant. The merge
 *                        threshold defaults to half of this so we only
 *                        collapse offsets STRICTLY tighter than the
 *                        intentional channel spacing — anything at or
 *                        beyond `paddingBuffer` was placed there
 *                        deliberately by TraceOverlapShiftSolver and must
 *                        not be reverted.
 * @param mergeDistance   optional explicit override of the threshold
 *
 * @returns               new traces array; inputs are not mutated.
 */
export const mergeCloseSameNetTraces = ({
  traces,
  paddingBuffer,
  mergeDistance,
}: {
  traces: SolvedTracePath[]
  paddingBuffer: number
  mergeDistance?: number
}): SolvedTracePath[] => {
  const threshold = mergeDistance ?? paddingBuffer * 0.5
  if (threshold <= 0 || traces.length < 2) return traces

  // Deep-copy each tracePath so mutations stay local.
  const newPaths: Point[][] = traces.map((t) =>
    t.tracePath.map((p) => ({ x: p.x, y: p.y })),
  )

  const groups = new Map<string, number[]>()
  for (let i = 0; i < traces.length; i++) {
    const key = traces[i].dcConnNetId
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(i)
  }

  for (const indices of groups.values()) {
    if (indices.length < 2) continue

    const segments: Segment[] = []
    for (const idx of indices) {
      const path = newPaths[idx]
      // Skip endpoint segments — those terminate at chip pins.
      for (let s = 1; s < path.length - 2; s++) {
        const a = path[s]
        const b = path[s + 1]
        if (isHorizontal(a, b)) {
          segments.push({
            orient: "H",
            y: (a.y + b.y) / 2,
            xMin: Math.min(a.x, b.x),
            xMax: Math.max(a.x, b.x),
            traceIdx: idx,
            segStart: s,
          })
        } else if (isVertical(a, b)) {
          segments.push({
            orient: "V",
            x: (a.x + b.x) / 2,
            yMin: Math.min(a.y, b.y),
            yMax: Math.max(a.y, b.y),
            traceIdx: idx,
            segStart: s,
          })
        }
      }
    }

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const s1 = segments[i]
        const s2 = segments[j]
        if (s1.orient !== s2.orient) continue
        if (s1.traceIdx === s2.traceIdx && s1.segStart === s2.segStart) continue

        if (s1.orient === "H" && s2.orient === "H") {
          const dy = Math.abs(s1.y - s2.y)
          if (dy < EPS || dy > threshold) continue
          const overlapMin = Math.max(s1.xMin, s2.xMin)
          const overlapMax = Math.min(s1.xMax, s2.xMax)
          if (overlapMax - overlapMin <= EPS) continue
          const midY = (s1.y + s2.y) / 2
          snapHorizontalSegment(newPaths[s1.traceIdx], s1.segStart, midY)
          snapHorizontalSegment(newPaths[s2.traceIdx], s2.segStart, midY)
          s1.y = midY
          s2.y = midY
        } else if (s1.orient === "V" && s2.orient === "V") {
          const dx = Math.abs(s1.x - s2.x)
          if (dx < EPS || dx > threshold) continue
          const overlapMin = Math.max(s1.yMin, s2.yMin)
          const overlapMax = Math.min(s1.yMax, s2.yMax)
          if (overlapMax - overlapMin <= EPS) continue
          const midX = (s1.x + s2.x) / 2
          snapVerticalSegment(newPaths[s1.traceIdx], s1.segStart, midX)
          snapVerticalSegment(newPaths[s2.traceIdx], s2.segStart, midX)
          s1.x = midX
          s2.x = midX
        }
      }
    }
  }

  return traces.map((t, i) => ({
    ...t,
    tracePath: simplifyPath(newPaths[i]),
  }))
}
