import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { RailOrientation, RailSegment } from "./types"

export const RAIL_ALIGNMENT_EPSILON = 2e-3

export const nearlyEqual = (a: number, b: number) =>
  Math.abs(a - b) < RAIL_ALIGNMENT_EPSILON

export const isHorizontal = (a: Point, b: Point) => nearlyEqual(a.y, b.y)

export const isVertical = (a: Point, b: Point) => nearlyEqual(a.x, b.x)

const isPositiveLength = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) >= RAIL_ALIGNMENT_EPSILON ||
  Math.abs(a.y - b.y) >= RAIL_ALIGNMENT_EPSILON

export const getRailOrientation = (
  a: Point,
  b: Point,
): RailOrientation | null => {
  if (!isPositiveLength(a, b)) return null
  if (isVertical(a, b)) return "vertical"
  if (isHorizontal(a, b)) return "horizontal"
  return null
}

export const rangesTouchOrOverlap = (a: RailSegment, b: RailSegment) =>
  Math.min(a.maxAlong, b.maxAlong) - Math.max(a.minAlong, b.minAlong) >=
  -RAIL_ALIGNMENT_EPSILON

export const pointsEqual = (a: Point, b: Point) =>
  nearlyEqual(a.x, b.x) && nearlyEqual(a.y, b.y)

export const getDistinctCoordinates = (coordinates: number[]) => {
  const distinct: number[] = []
  for (const coordinate of coordinates) {
    if (!distinct.some((item) => nearlyEqual(item, coordinate))) {
      distinct.push(coordinate)
    }
  }
  return distinct
}

interface Interval {
  coordinate: number
  min: number
  max: number
}

const getMergedIntervalLength = (intervals: Interval[]) => {
  const groups: Interval[][] = []
  for (const interval of intervals) {
    const group = groups.find((items) =>
      nearlyEqual(items[0]!.coordinate, interval.coordinate),
    )
    if (group) group.push(interval)
    else groups.push([interval])
  }

  return groups.reduce((total, group) => {
    const sorted = [...group].sort((a, b) => a.min - b.min)
    let groupLength = 0
    let currentMin = sorted[0]!.min
    let currentMax = sorted[0]!.max

    for (const interval of sorted.slice(1)) {
      if (interval.min <= currentMax + RAIL_ALIGNMENT_EPSILON) {
        currentMax = Math.max(currentMax, interval.max)
      } else {
        groupLength += currentMax - currentMin
        currentMin = interval.min
        currentMax = interval.max
      }
    }

    return total + groupLength + currentMax - currentMin
  }, 0)
}

/** Returns rendered length after overlapping collinear runs are merged. */
export const getVisibleTraceLength = (traces: SolvedTracePath[]) => {
  const horizontal: Interval[] = []
  const vertical: Interval[] = []

  for (const trace of traces) {
    for (let index = 0; index < trace.tracePath.length - 1; index++) {
      const start = trace.tracePath[index]!
      const end = trace.tracePath[index + 1]!

      if (isHorizontal(start, end)) {
        horizontal.push({
          coordinate: start.y,
          min: Math.min(start.x, end.x),
          max: Math.max(start.x, end.x),
        })
      } else if (isVertical(start, end)) {
        vertical.push({
          coordinate: start.x,
          min: Math.min(start.y, end.y),
          max: Math.max(start.y, end.y),
        })
      }
    }
  }

  return getMergedIntervalLength(horizontal) + getMergedIntervalLength(vertical)
}
