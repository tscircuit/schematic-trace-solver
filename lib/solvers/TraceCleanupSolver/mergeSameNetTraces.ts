import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"

const MERGE_TOLERANCE = 2e-3
const MIN_MERGE_SEGMENT_LENGTH = 0.5

const coordsEqual = (a: number, b: number) =>
  Math.abs(a - b) < MERGE_TOLERANCE

interface ObstacleRect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Merges same-net traces whose segments run parallel and close together onto a
 * shared coordinate line (same Y for horizontal runs, same X for vertical runs)
 * so that two nearly-overlapping same-net rails become one visually single line.
 *
 * A segment from the "movable" trace is snapped toward the other trace's
 * parallel segment only when:
 *  - both segments are axis-aligned and parallel (same orientation)
 *  - their perpendicular offset is within MERGE_TOLERANCE
 *  - their along-axis spans overlap by a meaningful length
 *  - moving the segment does not introduce any collisions
 */
export const mergeSameNetTraces = ({
  inputProblem,
  traces,
  netLabelPlacements,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}): {
  traces: SolvedTracePath[]
  mergedSegmentCount: number
} => {
  let outputTraces = traces.map((t) => ({ ...t, tracePath: [...t.tracePath] }))
  let mergedSegmentCount = 0

  const obstacles = getObstacleRects(inputProblem)
  const tolerancePaddedObstacles: ObstacleRect[] = obstacles.map((obs) => ({
    minX: obs.minX + 1e-5,
    maxX: obs.maxX - 1e-5,
    minY: obs.minY + 1e-5,
    maxY: obs.maxY - 1e-5,
  }))

  const labelBounds = netLabelPlacements.map((nl) => ({
    minX: nl.center.x - nl.width / 2 + 1e-5,
    maxX: nl.center.x + nl.width / 2 - 1e-5,
    minY: nl.center.y - nl.height / 2 + 1e-5,
    maxY: nl.center.y + nl.height / 2 - 1e-5,
  }))

  const segmentIntersectsAnyRect = (
    p1: Point,
    p2: Point,
    rects: ObstacleRect[],
  ): boolean => {
    for (const rect of rects) {
      if (segmentIntersectsRect(p1, p2, rect)) {
        return true
      }
    }
    return false
  }

  const getTraceObstacles = (
    traces: SolvedTracePath[],
    excludeMspPairId: string,
  ): ObstacleRect[] => {
    const TRACE_WIDTH = 0.01
    return traces
      .filter((t) => t.mspPairId !== excludeMspPairId)
      .flatMap((trace, i) =>
        trace.tracePath.slice(0, -1).map((p1, pi) => {
          const p2 = trace.tracePath[pi + 1]!
          return {
            minX: Math.min(p1.x, p2.x) - TRACE_WIDTH / 2,
            minY: Math.min(p1.y, p2.y) - TRACE_WIDTH / 2,
            maxX: Math.max(p1.x, p2.x) + TRACE_WIDTH / 2,
            maxY: Math.max(p1.y, p2.y) + TRACE_WIDTH / 2,
          }
        }),
      )
  }

  const getOtherTraces = (
    traces: SolvedTracePath[],
    targetIndex: number,
  ): SolvedTracePath[] =>
    traces.filter(
      (t, i) =>
        i !== targetIndex &&
        t.globalConnNetId === traces[targetIndex].globalConnNetId,
    )

  for (let ti = 0; ti < outputTraces.length; ti++) {
    const trace = outputTraces[ti]
    const path = trace.tracePath
    if (path.length < 3) continue

    const sameNetTraces = getOtherTraces(outputTraces, ti)
    if (sameNetTraces.length === 0) continue

    const otherTraces = outputTraces.filter(
      (t) => t.mspPairId !== trace.mspPairId,
    )

    for (let si = 1; si < path.length - 1; si++) {
      const prev = path[si - 1]
      const cur = path[si]
      const next = path[si + 1]

      const isHorizontalSeg = coordsEqual(prev.y, cur.y)
      const isVerticalSeg = coordsEqual(prev.x, cur.x)
      if (!isHorizontalSeg && !isVerticalSeg) continue

      const segLength = isHorizontalSeg
        ? Math.abs(cur.x - prev.x)
        : Math.abs(cur.y - prev.y)
      if (segLength < MIN_MERGE_SEGMENT_LENGTH) continue

      // The moving coordinate (perpendicular offset direction)
      let bestOffset: number | null = null
      let newCurX = cur.x
      let newCurY = cur.y

      for (const other of sameNetTraces) {
        for (let oi = 1; oi < other.tracePath.length; oi++) {
          const oPrev = other.tracePath[oi - 1]
          const oCur = other.tracePath[oi]

          const oHorizontal = coordsEqual(oPrev.y, oCur.y)
          const oVertical = coordsEqual(oPrev.x, oCur.x)
          if (isHorizontalSeg && !oHorizontal) continue
          if (isVerticalSeg && !oVertical) continue

          const oLength = isHorizontalSeg
            ? Math.abs(oCur.x - oPrev.x)
            : Math.abs(oCur.y - oPrev.y)
          if (oLength < MIN_MERGE_SEGMENT_LENGTH) continue

          let offset: number
          let overlap: number
          if (isHorizontalSeg) {
            offset = oCur.y - cur.y
            const min = Math.max(Math.min(prev.x, cur.x), Math.min(oPrev.x, oCur.x))
            const max = Math.min(Math.max(prev.x, cur.x), Math.max(oPrev.x, oCur.x))
            overlap = max - min
          } else {
            offset = oCur.x - cur.x
            const min = Math.max(Math.min(prev.y, cur.y), Math.min(oPrev.y, oCur.y))
            const max = Math.min(Math.max(prev.y, cur.y), Math.max(oPrev.y, oCur.y))
            overlap = max - min
          }

          if (process.env.MERGE_DEBUG) {
            console.log("cand", { isHorizontalSeg, offset, overlap, si, oi })
          }
          if (overlap < MIN_MERGE_SEGMENT_LENGTH) continue
          if (Math.abs(offset) > MERGE_TOLERANCE || offset === 0) continue

          // Candidate: move cur onto the other trace's coordinate.
          // Keep the smallest-magnitude offset found.
          if (
            bestOffset === null ||
            Math.abs(offset) < Math.abs(bestOffset)
          ) {
            bestOffset = offset
            if (isHorizontalSeg) {
              newCurY = cur.y + offset
            } else {
              newCurX = cur.x + offset
            }
          }
        }
      }

      if (process.env.MERGE_DEBUG) {
        console.log("bestOffset", bestOffset, "si", si)
      }
      if (bestOffset === null) continue

      // Build the moved segment endpoints
      const movedPrev: Point = isHorizontalSeg
        ? { x: prev.x, y: newCurY }
        : { x: newCurX, y: prev.y }
      const movedCur: Point = isHorizontalSeg
        ? { x: cur.x, y: newCurY }
        : { x: newCurX, y: cur.y }
      const movedNext: Point = next
        ? isHorizontalSeg
          ? { x: next.x, y: newCurY }
          : { x: newCurX, y: next.y }
        : next

      // Verify no collisions with the moved segments.
      // The target same-net trace's own obstacle rects are excluded: merging
      // onto its line is the goal, so coincident overlap must not count as a
      // collision. Cross-net trace obstacles still apply.
      const crossNetTraces = otherTraces.filter(
        (t) => t.globalConnNetId !== trace.globalConnNetId,
      )
      const traceObstacles = getTraceObstacles(crossNetTraces, trace.mspPairId)
      const combinedObstacles = [
        ...tolerancePaddedObstacles,
        ...labelBounds,
        ...traceObstacles,
      ]

      const testSegments: Array<[Point, Point]> = [
        [prev, movedCur],
        [movedPrev, movedCur],
        [movedCur, movedNext ?? next],
      ].filter((s): s is [Point, Point] => s.every(Boolean))

      let collides = false
      if (process.env.MERGE_DEBUG) {
        console.log("collides?", collides, JSON.stringify(combinedObstacles.length))
      }
      for (const [a, b] of testSegments) {
        if (segmentIntersectsAnyRect(a, b, combinedObstacles)) {
          collides = true
          break
        }
      }
      if (collides) continue

      // Apply: move cur (and adjacent run points that share the offset axis)
      if (isHorizontalSeg) {
        path[si].y = newCurY
        if (next && coordsEqual(cur.y, next.y) === false && coordsEqual(next.y, cur.y - bestOffset) === false) {
          // next stays; only cur moved
        }
      } else {
        path[si].x = newCurX
      }
      mergedSegmentCount++
    }
  }

  return { traces: outputTraces, mergedSegmentCount }
}
