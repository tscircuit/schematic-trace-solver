import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"
import { EPS, TRACE_BOUNDARY_TOLERANCE } from "./constants"
import type { Bounds, ChipSide } from "./types"

export const isYOrientation = (
  orientation: FacingDirection,
): orientation is "y+" | "y-" => orientation === "y+" || orientation === "y-"

export const isXOrientation = (
  orientation: FacingDirection,
): orientation is "x+" | "x-" => orientation === "x+" || orientation === "x-"

export const rectsOverlap = (a: Bounds, b: Bounds) =>
  Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > EPS &&
  Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) > EPS

export const rangesOverlap = (
  minA: number,
  maxA: number,
  minB: number,
  maxB: number,
) => Math.min(maxA, maxB) - Math.max(minA, minB) > EPS

export const traceCrossesBoundsInterior = (
  bounds: Bounds,
  traceMap: Record<string, SolvedTracePath>,
) => {
  for (const trace of Object.values(traceMap)) {
    const points = trace.tracePath
    for (let i = 0; i < points.length - 1; i++) {
      if (segmentCrossesBoundsInterior(points[i]!, points[i + 1]!, bounds)) {
        return true
      }
    }
  }

  return false
}

const segmentCrossesBoundsInterior = (p1: Point, p2: Point, bounds: Bounds) => {
  const interiorBounds = {
    minX: bounds.minX + TRACE_BOUNDARY_TOLERANCE,
    minY: bounds.minY + TRACE_BOUNDARY_TOLERANCE,
    maxX: bounds.maxX - TRACE_BOUNDARY_TOLERANCE,
    maxY: bounds.maxY - TRACE_BOUNDARY_TOLERANCE,
  }

  if (
    interiorBounds.minX >= interiorBounds.maxX ||
    interiorBounds.minY >= interiorBounds.maxY
  ) {
    return false
  }

  if (sameX(p1, p2)) {
    if (
      p1.x <= interiorBounds.minX + EPS ||
      p1.x >= interiorBounds.maxX - EPS
    ) {
      return false
    }
    return rangesOverlap(
      Math.min(p1.y, p2.y),
      Math.max(p1.y, p2.y),
      interiorBounds.minY,
      interiorBounds.maxY,
    )
  }

  if (sameY(p1, p2)) {
    if (
      p1.y <= interiorBounds.minY + EPS ||
      p1.y >= interiorBounds.maxY - EPS
    ) {
      return false
    }
    return rangesOverlap(
      Math.min(p1.x, p2.x),
      Math.max(p1.x, p2.x),
      interiorBounds.minX,
      interiorBounds.maxX,
    )
  }

  return false
}

export const tracePathCrossesAnyTrace = (
  tracePath: Point[],
  traceMap: Record<string, SolvedTracePath>,
) => {
  for (const trace of Object.values(traceMap)) {
    const points = trace.tracePath
    for (let i = 0; i < tracePath.length - 1; i++) {
      for (let j = 0; j < points.length - 1; j++) {
        if (
          segmentsStrictlyCross(
            tracePath[i]!,
            tracePath[i + 1]!,
            points[j]!,
            points[j + 1]!,
          )
        ) {
          return true
        }
      }
    }
  }

  return false
}

const segmentsStrictlyCross = (a1: Point, a2: Point, b1: Point, b2: Point) => {
  if (sameX(a1, a2) && sameY(b1, b2)) {
    return (
      a1.x > Math.min(b1.x, b2.x) + EPS &&
      a1.x < Math.max(b1.x, b2.x) - EPS &&
      b1.y > Math.min(a1.y, a2.y) + EPS &&
      b1.y < Math.max(a1.y, a2.y) - EPS
    )
  }

  if (sameY(a1, a2) && sameX(b1, b2)) {
    return (
      b1.x > Math.min(a1.x, a2.x) + EPS &&
      b1.x < Math.max(a1.x, a2.x) - EPS &&
      a1.y > Math.min(b1.y, b2.y) + EPS &&
      a1.y < Math.max(b1.y, b2.y) - EPS
    )
  }

  return false
}

export const getSideDistances = (point: Point, bounds: Bounds) =>
  [
    ["left", Math.abs(point.x - bounds.minX)] as const,
    ["right", Math.abs(point.x - bounds.maxX)] as const,
    ["bottom", Math.abs(point.y - bounds.minY)] as const,
    ["top", Math.abs(point.y - bounds.maxY)] as const,
  ] satisfies Array<readonly [ChipSide, number]>

export const getConnectorTracePath = (
  source: Point,
  target: Point,
  orientation: FacingDirection,
) =>
  simplifyOrthogonalPath(
    isYOrientation(orientation)
      ? [source, { x: target.x, y: source.y }, target]
      : [source, { x: source.x, y: target.y }, target],
  )

const simplifyOrthogonalPath = (path: Point[]) => {
  const deduped = path.filter(
    (point, index) => index === 0 || !pointsEqual(point, path[index - 1]!),
  )
  if (deduped.length < 3) return deduped

  const simplified: Point[] = [deduped[0]!]
  for (let i = 1; i < deduped.length - 1; i++) {
    const prev = simplified[simplified.length - 1]!
    const point = deduped[i]!
    const next = deduped[i + 1]!
    if (
      (sameX(prev, point) && sameX(point, next)) ||
      (sameY(prev, point) && sameY(point, next))
    ) {
      continue
    }
    simplified.push(point)
  }
  simplified.push(deduped[deduped.length - 1]!)
  return simplified
}

const pointsEqual = (a: Point, b: Point) => sameX(a, b) && sameY(a, b)

const sameX = (a: Point, b: Point) => Math.abs(a.x - b.x) <= EPS

const sameY = (a: Point, b: Point) => Math.abs(a.y - b.y) <= EPS

export const getMaxSearchDistance = (inputProblem: InputProblem) => {
  const maxChipWidth = Math.max(
    ...inputProblem.chips.map((chip) => chip.width),
    1,
  )
  return maxChipWidth * 3
}
