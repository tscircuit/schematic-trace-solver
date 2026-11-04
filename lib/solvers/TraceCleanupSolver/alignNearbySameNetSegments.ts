import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isPathCollidingWithObstacles,
  segmentIntersectsRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import {
  getObstacleRects,
  type ObstacleRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import type { InputProblem } from "lib/types/InputProblem"
import {
  doesPathCoincideWithTraces,
  doesPathOverlapTraceStrokes,
} from "lib/utils/doesPathCoincideWithTraces"
import {
  getDistinctCoordinates,
  getRailOrientation,
  nearlyEqual,
  pointsEqual,
  RAIL_ALIGNMENT_EPSILON,
  rangesTouchOrOverlap,
} from "./sameNetRailAlignment/geometry"
import { preservesLabelAnchors } from "./sameNetRailAlignment/preservesLabelAnchors"
import {
  getTraceGeometryMetrics,
  scoreIsBetter,
} from "./sameNetRailAlignment/scoreRailAlignment"
import type {
  AlignmentCandidate,
  AlignmentScore,
  RailOrientation,
} from "./sameNetRailAlignment/types"
import { simplifyPath } from "./simplifyPath"

export interface AlignNearbySameNetSegmentsInput {
  traces: SolvedTracePath[]
  inputProblem?: InputProblem
  netLabelPlacements?: NetLabelPlacement[]
  eligibleTraceIds?: ReadonlySet<string>
  maxDistance?: number
}

interface InternalSegment {
  traceId: string
  segmentIndex: number
  globalConnNetId: string
  orientation: RailOrientation
  coordinate: number
  minAlong: number
  maxAlong: number
  length: number
}

const DEFAULT_MAX_DISTANCE = 0.15

const getMovableInternalSegments = (
  trace: SolvedTracePath,
): InternalSegment[] => {
  const segments: InternalSegment[] = []
  const path = trace.tracePath

  for (let segmentIndex = 1; segmentIndex < path.length - 2; segmentIndex++) {
    const previous = path[segmentIndex - 1]!
    const start = path[segmentIndex]!
    const end = path[segmentIndex + 1]!
    const next = path[segmentIndex + 2]!
    const orientation = getRailOrientation(start, end)
    if (!orientation) continue

    const previousOrientation = getRailOrientation(previous, start)
    const nextOrientation = getRailOrientation(end, next)
    if (!previousOrientation || !nextOrientation) continue
    if (previousOrientation === orientation || nextOrientation === orientation)
      continue

    const alongValues =
      orientation === "vertical" ? [start.y, end.y] : [start.x, end.x]
    const minAlong = Math.min(...alongValues)
    const maxAlong = Math.max(...alongValues)
    segments.push({
      traceId: trace.mspPairId,
      segmentIndex,
      globalConnNetId: trace.globalConnNetId,
      orientation,
      coordinate: orientation === "vertical" ? start.x : start.y,
      minAlong,
      maxAlong,
      length: maxAlong - minAlong,
    })
  }

  return segments
}

const getCorridor = (
  a: InternalSegment,
  b: InternalSegment,
): [Point, Point] => {
  const overlapMin = Math.max(a.minAlong, b.minAlong)
  const overlapMax = Math.min(a.maxAlong, b.maxAlong)
  const along = (overlapMin + overlapMax) / 2

  return a.orientation === "vertical"
    ? [
        { x: a.coordinate, y: along },
        { x: b.coordinate, y: along },
      ]
    : [
        { x: along, y: a.coordinate },
        { x: along, y: b.coordinate },
      ]
}

const corridorIsClear = (
  a: InternalSegment,
  b: InternalSegment,
  obstacles: ObstacleRect[],
) => {
  if (!rangesTouchOrOverlap(a as any, b as any)) return false
  const [start, end] = getCorridor(a, b)
  return !obstacles.some((obstacle) =>
    segmentIntersectsRect(start, end, obstacle),
  )
}

const canJoinSegmentGroup = (
  start: InternalSegment,
  current: InternalSegment,
  candidate: InternalSegment,
  obstacles: ObstacleRect[],
  maxDistance: number,
) => {
  if (candidate.globalConnNetId !== start.globalConnNetId) return false
  if (candidate.orientation !== start.orientation) return false
  const axisDelta = Math.abs(current.coordinate - candidate.coordinate)
  if (axisDelta > maxDistance + RAIL_ALIGNMENT_EPSILON) return false
  const overlap =
    Math.min(current.maxAlong, candidate.maxAlong) -
    Math.max(current.minAlong, candidate.minAlong)
  if (overlap <= RAIL_ALIGNMENT_EPSILON) return false
  return corridorIsClear(current, candidate, obstacles)
}

const getNearbySegmentGroups = (
  traces: SolvedTracePath[],
  eligibleTraceIds: ReadonlySet<string>,
  obstacles: ObstacleRect[],
  maxDistance: number,
): InternalSegment[][] => {
  const eligibleTraces = traces.filter((trace) =>
    eligibleTraceIds.has(trace.mspPairId),
  )
  const segments = eligibleTraces.flatMap((trace) =>
    getMovableInternalSegments(trace),
  )
  const visited = new Set<number>()
  const groups: InternalSegment[][] = []

  for (let startIndex = 0; startIndex < segments.length; startIndex++) {
    if (visited.has(startIndex)) continue
    const start = segments[startIndex]!
    const queue = [startIndex]
    const group: InternalSegment[] = []
    visited.add(startIndex)

    for (let queueIndex = 0; queueIndex < queue.length; queueIndex++) {
      const current = segments[queue[queueIndex]!]!
      group.push(current)

      for (
        let candidateIndex = 0;
        candidateIndex < segments.length;
        candidateIndex++
      ) {
        if (visited.has(candidateIndex)) continue
        const candidate = segments[candidateIndex]!
        if (
          !canJoinSegmentGroup(
            start,
            current,
            candidate,
            obstacles,
            maxDistance,
          )
        ) {
          continue
        }
        visited.add(candidateIndex)
        queue.push(candidateIndex)
      }
    }

    const traceCount = new Set(group.map((segment) => segment.traceId)).size
    const hasDifferentCoordinates = group.some(
      (segment) => !nearlyEqual(segment.coordinate, group[0]!.coordinate),
    )
    if (traceCount >= 2 && hasDifferentCoordinates) {
      groups.push(group)
    }
  }

  return groups
}

const moveInternalSegments = (
  trace: SolvedTracePath,
  segments: InternalSegment[],
  coordinate: number,
): SolvedTracePath => {
  const pointsToMove = new Set<number>()
  for (const segment of segments) {
    if (nearlyEqual(segment.coordinate, coordinate)) continue
    pointsToMove.add(segment.segmentIndex)
    pointsToMove.add(segment.segmentIndex + 1)
  }

  const orientation = segments[0]!.orientation
  const tracePath = simplifyPath(
    trace.tracePath.map((point, index) => {
      if (!pointsToMove.has(index)) return point
      return orientation === "vertical"
        ? { ...point, x: coordinate }
        : { ...point, y: coordinate }
    }),
  )

  return { ...trace, tracePath }
}

const tracePathChanged = (
  original: SolvedTracePath,
  candidate: SolvedTracePath,
) =>
  original.tracePath.length !== candidate.tracePath.length ||
  candidate.tracePath.some(
    (point, index) => !pointsEqual(point, original.tracePath[index]!),
  )

const evaluateNearbyGroup = ({
  group,
  traces,
  netLabelPlacements,
  obstacles,
  eligibleTraceIds,
}: {
  group: InternalSegment[]
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  obstacles: ObstacleRect[]
  eligibleTraceIds: ReadonlySet<string>
}): AlignmentCandidate | null => {
  const groupTraceIds = new Set(group.map((segment) => segment.traceId))
  const originalGroupTraces = traces.filter((trace) =>
    groupTraceIds.has(trace.mspPairId),
  )
  const baseline = getTraceGeometryMetrics(originalGroupTraces, traces)
  const sortedByLength = [...group].sort((a, b) => b.length - a.length)
  const candidateCoordinates = getDistinctCoordinates(
    sortedByLength.map((segment) => segment.coordinate),
  )
  const otherNetTraces = traces.filter(
    (trace) => trace.globalConnNetId !== group[0]!.globalConnNetId,
  )
  const immutableSameNetTraces = traces.filter(
    (trace) =>
      trace.globalConnNetId === group[0]!.globalConnNetId &&
      !eligibleTraceIds.has(trace.mspPairId),
  )

  let best: AlignmentCandidate | null = null
  for (const coordinate of candidateCoordinates) {
    const candidateMap = new Map<string, SolvedTracePath>()
    for (const trace of originalGroupTraces) {
      const candidateTrace = moveInternalSegments(
        trace,
        group.filter((segment) => segment.traceId === trace.mspPairId),
        coordinate,
      )
      candidateMap.set(trace.mspPairId, candidateTrace)
    }

    const candidateTraces = [...candidateMap.values()]
    const allCandidateTraces = traces.map(
      (trace) => candidateMap.get(trace.mspPairId) ?? trace,
    )
    const candidatesAreClear = candidateTraces.every(
      (candidate) =>
        !isPathCollidingWithObstacles(candidate.tracePath, obstacles) &&
        detectTraceLabelOverlap({
          traces: [candidate],
          netLabels: netLabelPlacements,
        }).length === 0 &&
        !doesPathOverlapTraceStrokes(candidate.tracePath, otherNetTraces) &&
        !doesPathCoincideWithTraces(
          candidate.tracePath,
          immutableSameNetTraces.filter(
            (trace) => trace.mspPairId !== candidate.mspPairId,
          ),
        ),
    )
    if (!candidatesAreClear) continue
    if (
      !preservesLabelAnchors(netLabelPlacements, traces, allCandidateTraces)
    ) {
      continue
    }

    const metrics = getTraceGeometryMetrics(candidateTraces, allCandidateTraces)
    if (metrics.otherNetCrossings > baseline.otherNetCrossings) continue
    if (metrics.turnCount > baseline.turnCount) continue
    if (metrics.visibleLength > baseline.visibleLength + RAIL_ALIGNMENT_EPSILON)
      continue

    const score: AlignmentScore = {
      ...metrics,
      displacement: group.reduce(
        (sum, segment) => sum + Math.abs(segment.coordinate - coordinate),
        0,
      ),
      coordinate,
    }
    const changedTraceIds = candidateTraces
      .filter((candidate) => {
        const original = traces.find(
          (trace) => trace.mspPairId === candidate.mspPairId,
        )!
        return tracePathChanged(original, candidate)
      })
      .map((trace) => trace.mspPairId)
    if (changedTraceIds.length === 0) continue

    const candidate: AlignmentCandidate = {
      traces: allCandidateTraces,
      changedTraceIds,
      score,
    }
    if (!best || scoreIsBetter(candidate.score, best.score)) best = candidate
  }

  return best
}

const getTraceStateKey = (traces: SolvedTracePath[]) =>
  JSON.stringify(
    traces.map((trace) => ({
      mspPairId: trace.mspPairId,
      tracePath: trace.tracePath,
    })),
  )

export const alignNearbySameNetSegments = ({
  traces,
  inputProblem,
  netLabelPlacements = [],
  eligibleTraceIds,
  maxDistance = DEFAULT_MAX_DISTANCE,
}: AlignNearbySameNetSegmentsInput): {
  traces: SolvedTracePath[]
  alignedGroupCount: number
  alignedTraceCount: number
} => {
  let outputTraces = [...traces]
  const resolvedEligibleIds =
    eligibleTraceIds ?? new Set(traces.map((trace) => trace.mspPairId))
  const obstacles = inputProblem ? getObstacleRects(inputProblem) : []
  const seenStates = new Set([getTraceStateKey(outputTraces)])
  const alignedTraceIds = new Set<string>()
  let alignedGroupCount = 0
  const maxPasses = Math.max(1, traces.length * 2)

  for (let pass = 0; pass < maxPasses; pass++) {
    const groups = getNearbySegmentGroups(
      outputTraces,
      resolvedEligibleIds,
      obstacles,
      maxDistance,
    )
    let applied: AlignmentCandidate | null = null
    for (const group of groups) {
      applied = evaluateNearbyGroup({
        group,
        traces: outputTraces,
        netLabelPlacements,
        obstacles,
        eligibleTraceIds: resolvedEligibleIds,
      })
      if (applied) break
    }
    if (!applied) break

    const stateKey = getTraceStateKey(applied.traces)
    const repeatsSeenState = seenStates.has(stateKey)
    if (!repeatsSeenState) seenStates.add(stateKey)
    outputTraces = applied.traces
    alignedGroupCount++
    for (const traceId of applied.changedTraceIds) alignedTraceIds.add(traceId)
    if (repeatsSeenState) break
  }

  return {
    traces: outputTraces,
    alignedGroupCount,
    alignedTraceCount: alignedTraceIds.size,
  }
}
