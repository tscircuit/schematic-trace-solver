import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  getRailOrientation,
  nearlyEqual,
} from "./sameNetRailAlignment/geometry"
import type { RailOrientation } from "./sameNetRailAlignment/types"

/**
 * Merge same-net trace lines that are close together so that they render at the
 * same Y (for horizontal rails) or the same X (for vertical rails).
 *
 * Issue: https://github.com/tscircuit/schematic-trace-solver/issues/34
 *
 * When two collinear segments belonging to the same electrical net sit at
 * slightly different coordinates (e.g. y=2.0 and y=2.04) they look like two
 * parallel rails on the schematic even though they are electrically identical.
 * This pass snaps the segments of each such group onto a single shared
 * coordinate (the length-weighted average of the members), which removes the
 * visual "double rail" without changing connectivity or pin endpoints.
 */

export interface CloseSameNetRailSegment {
  traceId: string
  /** Index of the segment start point within its trace path. */
  segmentIndex: number
  orientation: RailOrientation
  /** The coordinate perpendicular to the run (y for horizontal, x for vertical). */
  coordinate: number
  minAlong: number
  maxAlong: number
}

export interface MergeCloseSameNetRailsInput {
  traces: SolvedTracePath[]
  eligibleTraceIds?: ReadonlySet<string>
  /**
   * Maximum distance between two rail coordinates for them to be considered
   * "close together" and therefore mergeable. Defaults to 0.2 schematic units.
   */
  maxCoordinateDelta?: number
}

export interface MergeCloseSameNetRailsResult {
  traces: SolvedTracePath[]
  mergedRailGroupCount: number
  mergedTraceCount: number
}

const DEFAULT_MAX_COORDINATE_DELTA = 0.2

const collectSegments = (trace: SolvedTracePath): CloseSameNetRailSegment[] => {
  const segments: CloseSameNetRailSegment[] = []
  const path = trace.tracePath
  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]!
    const end = path[i + 1]!
    const orientation = getRailOrientation(start, end)
    if (!orientation) continue
    const alongValues =
      orientation === "vertical" ? [start.y, end.y] : [start.x, end.x]
    segments.push({
      traceId: trace.mspPairId,
      segmentIndex: i,
      orientation,
      coordinate: orientation === "vertical" ? start.x : start.y,
      minAlong: Math.min(...alongValues),
      maxAlong: Math.max(...alongValues),
    })
  }
  return segments
}

const rangesOverlap = (
  a: CloseSameNetRailSegment,
  b: CloseSameNetRailSegment,
) =>
  Math.min(a.maxAlong, b.maxAlong) - Math.max(a.minAlong, b.minAlong) >=
  -DEFAULT_MAX_COORDINATE_DELTA

/**
 * Group collinear same-net segments whose perpendicular coordinates differ by
 * at most `maxCoordinateDelta` and whose along-ranges overlap. Each group is a
 * candidate for snapping onto a single shared coordinate.
 */
const buildMergeGroups = (
  segments: CloseSameNetRailSegment[],
  maxCoordinateDelta: number,
): CloseSameNetRailSegment[][] => {
  const visited = new Set<number>()
  const groups: CloseSameNetRailSegment[][] = []

  const compatible = (
    anchor: CloseSameNetRailSegment,
    candidate: CloseSameNetRailSegment,
  ) =>
    candidate.orientation === anchor.orientation &&
    Math.abs(candidate.coordinate - anchor.coordinate) <= maxCoordinateDelta &&
    rangesOverlap(anchor, candidate)

  for (let i = 0; i < segments.length; i++) {
    if (visited.has(i)) continue
    const anchor = segments[i]!
    const group: CloseSameNetRailSegment[] = [anchor]
    visited.add(i)
    for (let j = i + 1; j < segments.length; j++) {
      if (visited.has(j)) continue
      const candidate = segments[j]!
      if (compatible(anchor, candidate)) {
        group.push(candidate)
        visited.add(j)
      }
    }
    if (group.length >= 2) groups.push(group)
  }
  return groups
}

const lengthWeightedCoordinate = (group: CloseSameNetRailSegment[]) => {
  let weightedSum = 0
  let totalLength = 0
  for (const segment of group) {
    const length = segment.maxAlong - segment.minAlong
    weightedSum += segment.coordinate * length
    totalLength += length
  }
  return totalLength > 0 ? weightedSum / totalLength : group[0]!.coordinate
}

const applyCoordinate = (
  traces: SolvedTracePath[],
  updates: Map<string, Map<number, number>>,
): SolvedTracePath[] =>
  traces.map((trace) => {
    const perSegment = updates.get(trace.mspPairId)
    if (!perSegment || perSegment.size === 0) return trace
    const tracePath: Point[] = trace.tracePath.map((point) => ({ ...point }))
    for (const [segmentIndex, coordinate] of perSegment) {
      const start = tracePath[segmentIndex]!
      const end = tracePath[segmentIndex + 1]!
      const orientation = getRailOrientation(start, end)
      if (orientation === "vertical") {
        start.x = coordinate
        end.x = coordinate
      } else if (orientation === "horizontal") {
        start.y = coordinate
        end.y = coordinate
      }
    }
    return { ...trace, tracePath }
  })

export const mergeCloseSameNetRails = ({
  traces,
  eligibleTraceIds,
  maxCoordinateDelta = DEFAULT_MAX_COORDINATE_DELTA,
}: MergeCloseSameNetRailsInput): MergeCloseSameNetRailsResult => {
  const eligible = eligibleTraceIds ?? new Set(traces.map((t) => t.mspPairId))

  // Collect segments per net so we never merge across different nets.
  const segmentsByNet = new Map<string, CloseSameNetRailSegment[]>()
  for (const trace of traces) {
    if (!eligible.has(trace.mspPairId)) continue
    const segments = collectSegments(trace)
    const bucket = segmentsByNet.get(trace.globalConnNetId) ?? []
    bucket.push(...segments)
    segmentsByNet.set(trace.globalConnNetId, bucket)
  }

  const updates = new Map<string, Map<number, number>>()
  const mergedTraceIds = new Set<string>()
  let mergedRailGroupCount = 0

  for (const segments of segmentsByNet.values()) {
    for (const group of buildMergeGroups(segments, maxCoordinateDelta)) {
      const target = lengthWeightedCoordinate(group)
      // Only snap when at least one member actually needs to move.
      const needsMove = group.some(
        (segment) => !nearlyEqual(segment.coordinate, target),
      )
      if (!needsMove) continue
      mergedRailGroupCount++
      for (const segment of group) {
        let perSegment = updates.get(segment.traceId)
        if (!perSegment) {
          perSegment = new Map()
          updates.set(segment.traceId, perSegment)
        }
        perSegment.set(segment.segmentIndex, target)
        mergedTraceIds.add(segment.traceId)
      }
    }
  }

  return {
    traces: applyCoordinate(traces, updates),
    mergedRailGroupCount,
    mergedTraceCount: mergedTraceIds.size,
  }
}
