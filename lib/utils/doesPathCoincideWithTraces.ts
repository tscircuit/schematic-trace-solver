import { boundsIntersection, type Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const COINCIDENT_EPS = 2e-3
const GEOMETRY_EPS = 1e-6

// Schematic traces are rendered 0.02 schematic units wide.
export const SCHEMATIC_TRACE_STROKE_WIDTH = 0.02
export const SCHEMATIC_TRACE_MIN_CENTERLINE_CLEARANCE =
  SCHEMATIC_TRACE_STROKE_WIDTH + GEOMETRY_EPS
// Rail-alignment fallbacks need a visible gap, not only non-overlapping trace
// bodies. Three stroke widths of centerline separation leave two stroke widths
// of whitespace between the rendered traces.
export const SCHEMATIC_TRACE_MIN_VISUAL_CENTERLINE_CLEARANCE =
  SCHEMATIC_TRACE_STROKE_WIDTH * 3

/**
 * Returns true when an orthogonal path shares a positive-length segment with
 * an existing trace. Perpendicular crossings and point-only contact are
 * intentionally allowed.
 */
export const doesPathCoincideWithTraces = (
  path: Point[],
  traces: SolvedTracePath[],
): boolean => {
  const rangesOverlap1D = (a1: number, a2: number, b1: number, b2: number) =>
    Math.min(Math.max(a1, a2), Math.max(b1, b2)) -
      Math.max(Math.min(a1, a2), Math.min(b1, b2)) >
    COINCIDENT_EPS

  for (let i = 0; i < path.length - 1; i++) {
    const pathSegStart = path[i]!
    const pathSegEnd = path[i + 1]!
    const isVertical = Math.abs(pathSegStart.x - pathSegEnd.x) < COINCIDENT_EPS
    const isHorizontal =
      Math.abs(pathSegStart.y - pathSegEnd.y) < COINCIDENT_EPS
    if (!isVertical && !isHorizontal) continue

    const crossAxis = isVertical ? "x" : "y"
    const alongAxis = isVertical ? "y" : "x"

    for (const trace of traces) {
      for (let j = 0; j < trace.tracePath.length - 1; j++) {
        const traceSegStart = trace.tracePath[j]!
        const traceSegEnd = trace.tracePath[j + 1]!

        const isParallel =
          Math.abs(traceSegStart[crossAxis] - traceSegEnd[crossAxis]) <
          COINCIDENT_EPS
        if (!isParallel) continue

        const isCoincident =
          Math.abs(pathSegStart[crossAxis] - traceSegStart[crossAxis]) <
          COINCIDENT_EPS
        if (!isCoincident) continue

        if (
          rangesOverlap1D(
            pathSegStart[alongAxis],
            pathSegEnd[alongAxis],
            traceSegStart[alongAxis],
            traceSegEnd[alongAxis],
          )
        ) {
          return true
        }
      }
    }
  }

  return false
}

/** Returns true when the rendered strokes of parallel trace runs overlap. */
export const doesPathOverlapTraceStrokes = (
  path: Point[],
  traces: SolvedTracePath[],
): boolean => {
  const traceStrokeRadius = SCHEMATIC_TRACE_MIN_CENTERLINE_CLEARANCE / 2
  const getStrokeBounds = (start: Point, end: Point, isVertical: boolean) =>
    isVertical
      ? {
          minX: start.x - traceStrokeRadius,
          maxX: start.x + traceStrokeRadius,
          minY: Math.min(start.y, end.y),
          maxY: Math.max(start.y, end.y),
        }
      : {
          minX: Math.min(start.x, end.x),
          maxX: Math.max(start.x, end.x),
          minY: start.y - traceStrokeRadius,
          maxY: start.y + traceStrokeRadius,
        }

  for (let pathIndex = 0; pathIndex < path.length - 1; pathIndex++) {
    const pathStart = path[pathIndex]!
    const pathEnd = path[pathIndex + 1]!
    const isVertical = Math.abs(pathStart.x - pathEnd.x) < COINCIDENT_EPS
    const isHorizontal = Math.abs(pathStart.y - pathEnd.y) < COINCIDENT_EPS
    if (!isVertical && !isHorizontal) continue

    const pathBounds = getStrokeBounds(pathStart, pathEnd, isVertical)
    for (const trace of traces) {
      for (
        let traceIndex = 0;
        traceIndex < trace.tracePath.length - 1;
        traceIndex++
      ) {
        const traceStart = trace.tracePath[traceIndex]!
        const traceEnd = trace.tracePath[traceIndex + 1]!
        const isParallel = isVertical
          ? Math.abs(traceStart.x - traceEnd.x) < COINCIDENT_EPS
          : Math.abs(traceStart.y - traceEnd.y) < COINCIDENT_EPS
        if (!isParallel) continue

        const overlap = boundsIntersection(
          pathBounds,
          getStrokeBounds(traceStart, traceEnd, isVertical),
        )
        if (!overlap) continue

        const overlapLength = isVertical
          ? overlap.maxY - overlap.minY
          : overlap.maxX - overlap.minX
        if (overlapLength > COINCIDENT_EPS) return true
      }
    }
  }

  return false
}
