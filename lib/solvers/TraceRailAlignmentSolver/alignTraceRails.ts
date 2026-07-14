import type { Point } from "@tscircuit/math-utils"
import {
  countPathIntersections,
  getPathLength,
} from "lib/solvers/Example28Solver/geometry"
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
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import type { InputProblem } from "lib/types/InputProblem"

const EPS = 2e-3

type RailOrientation = "horizontal" | "vertical"

type RailSegment = {
  traceId: string
  segmentIndex: number
  globalConnNetId: string
  orientation: RailOrientation
  coordinate: number
  minAlong: number
  maxAlong: number
}

type AlignmentCandidate = {
  traces: SolvedTracePath[]
  changedTraceIds: string[]
  pathLength: number
  otherNetCrossings: number
  displacement: number
  coordinate: number
}

const nearlyEqual = (a: number, b: number) => Math.abs(a - b) < EPS

const isHorizontal = (a: Point, b: Point) => nearlyEqual(a.y, b.y)
const isVertical = (a: Point, b: Point) => nearlyEqual(a.x, b.x)

const isAxisAligned = (a: Point, b: Point) =>
  isHorizontal(a, b) || isVertical(a, b)

const isPositiveLength = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) >= EPS || Math.abs(a.y - b.y) >= EPS

const getOrientation = (a: Point, b: Point): RailOrientation | null => {
  if (!isPositiveLength(a, b)) return null
  if (isVertical(a, b)) return "vertical"
  if (isHorizontal(a, b)) return "horizontal"
  return null
}

/**
 * A movable rail is an internal orthogonal segment with perpendicular legs on
 * both sides. Moving it changes only bend coordinates and never a trace endpoint.
 */
const getMovableRailSegments = (trace: SolvedTracePath): RailSegment[] => {
  if (trace.traceRole === "net-label-connector") return []

  const segments: RailSegment[] = []
  const path = trace.tracePath
  for (let segmentIndex = 1; segmentIndex < path.length - 2; segmentIndex++) {
    const previous = path[segmentIndex - 1]!
    const start = path[segmentIndex]!
    const end = path[segmentIndex + 1]!
    const next = path[segmentIndex + 2]!
    const orientation = getOrientation(start, end)
    if (!orientation) continue

    const previousOrientation = getOrientation(previous, start)
    const nextOrientation = getOrientation(end, next)
    if (!previousOrientation || !nextOrientation) continue
    if (previousOrientation === orientation || nextOrientation === orientation)
      continue

    const alongValues =
      orientation === "vertical" ? [start.y, end.y] : [start.x, end.x]
    segments.push({
      traceId: trace.mspPairId,
      segmentIndex,
      globalConnNetId: trace.globalConnNetId,
      orientation,
      coordinate: orientation === "vertical" ? start.x : start.y,
      minAlong: Math.min(...alongValues),
      maxAlong: Math.max(...alongValues),
    })
  }

  return segments
}

const rangesTouchOrOverlap = (a: RailSegment, b: RailSegment) =>
  Math.min(a.maxAlong, b.maxAlong) - Math.max(a.minAlong, b.minAlong) >= -EPS

const getCorridor = (a: RailSegment, b: RailSegment): [Point, Point] => {
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
  a: RailSegment,
  b: RailSegment,
  obstacles: ObstacleRect[],
) => {
  const [start, end] = getCorridor(a, b)
  return !obstacles.some((obstacle) =>
    segmentIntersectsRect(start, end, obstacle),
  )
}

const getRailGroups = (
  traces: SolvedTracePath[],
  obstacles: ObstacleRect[],
): RailSegment[][] => {
  const segments = traces.flatMap(getMovableRailSegments)
  const traceMap = new Map(traces.map((trace) => [trace.mspPairId, trace]))
  const visited = new Set<number>()
  const groups: RailSegment[][] = []

  const areTopologicallyRelated = (a: RailSegment, b: RailSegment) => {
    if (a.traceId === b.traceId) return true
    const aTrace = traceMap.get(a.traceId)!
    const bTrace = traceMap.get(b.traceId)!
    const aPinIds = new Set(aTrace.pins.map((pin) => pin.pinId))
    return bTrace.pins.some((pin) => aPinIds.has(pin.pinId))
  }

  for (let startIndex = 0; startIndex < segments.length; startIndex++) {
    if (visited.has(startIndex)) continue
    const start = segments[startIndex]!
    const queue = [startIndex]
    const group: RailSegment[] = []
    visited.add(startIndex)

    while (queue.length > 0) {
      const currentIndex = queue.shift()!
      const current = segments[currentIndex]!
      group.push(current)

      for (
        let candidateIndex = 0;
        candidateIndex < segments.length;
        candidateIndex++
      ) {
        if (visited.has(candidateIndex)) continue
        const candidate = segments[candidateIndex]!
        if (
          candidate.globalConnNetId !== start.globalConnNetId ||
          candidate.orientation !== start.orientation ||
          (!rangesTouchOrOverlap(current, candidate) &&
            !areTopologicallyRelated(current, candidate)) ||
          !corridorIsClear(current, candidate, obstacles)
        )
          continue

        visited.add(candidateIndex)
        queue.push(candidateIndex)
      }
    }

    if (
      new Set(group.map((segment) => segment.traceId)).size >= 2 &&
      new Set(group.map((segment) => segment.coordinate)).size >= 2
    ) {
      groups.push(group)
    }
  }

  return groups
}

const moveRailSegments = (
  trace: SolvedTracePath,
  segments: RailSegment[],
  coordinate: number,
): SolvedTracePath => {
  const pointsToMove = new Set<number>()
  for (const segment of segments) {
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

const pointsEqual = (a: Point, b: Point) =>
  nearlyEqual(a.x, b.x) && nearlyEqual(a.y, b.y)

const isValidOrthogonalPathWithFixedEndpoints = (
  originalPath: Point[],
  candidatePath: Point[],
) => {
  if (candidatePath.length < 2) return false
  if (!pointsEqual(originalPath[0]!, candidatePath[0]!)) return false
  if (!pointsEqual(originalPath.at(-1)!, candidatePath.at(-1)!)) return false
  return candidatePath.slice(0, -1).every((point, index) => {
    const next = candidatePath[index + 1]!
    return isPositiveLength(point, next) && isAxisAligned(point, next)
  })
}

const isPointOnSegment = (point: Point, start: Point, end: Point) => {
  if (isVertical(start, end)) {
    return (
      nearlyEqual(point.x, start.x) &&
      point.y >= Math.min(start.y, end.y) - EPS &&
      point.y <= Math.max(start.y, end.y) + EPS
    )
  }
  if (isHorizontal(start, end)) {
    return (
      nearlyEqual(point.y, start.y) &&
      point.x >= Math.min(start.x, end.x) - EPS &&
      point.x <= Math.max(start.x, end.x) + EPS
    )
  }
  return false
}

const isPointOnPath = (point: Point, path: Point[]) =>
  path
    .slice(0, -1)
    .some((start, index) => isPointOnSegment(point, start, path[index + 1]!))

/**
 * Labels that were anchored to routed geometry must remain anchored. Port-only
 * labels that were never on a trace are intentionally ignored.
 */
const preservesExistingLabelAnchors = (
  labels: NetLabelPlacement[],
  before: SolvedTracePath[],
  after: SolvedTracePath[],
) =>
  labels.every((label) => {
    const wasAnchored = before.some(
      (trace) =>
        trace.globalConnNetId === label.globalConnNetId &&
        isPointOnPath(label.anchorPoint, trace.tracePath),
    )
    if (!wasAnchored) return true
    return after.some(
      (trace) =>
        trace.globalConnNetId === label.globalConnNetId &&
        isPointOnPath(label.anchorPoint, trace.tracePath),
    )
  })

const countOtherNetCrossings = (
  traces: SolvedTracePath[],
  allTraces: SolvedTracePath[],
) => {
  let crossings = 0
  for (const trace of traces) {
    for (const otherTrace of allTraces) {
      if (trace.globalConnNetId === otherTrace.globalConnNetId) continue
      crossings += countPathIntersections(trace.tracePath, otherTrace.tracePath)
    }
  }
  return crossings
}

const isBetterCandidate = (
  candidate: AlignmentCandidate,
  best: AlignmentCandidate | null,
) => {
  if (!best) return true
  if (!nearlyEqual(candidate.pathLength, best.pathLength))
    return candidate.pathLength < best.pathLength
  if (candidate.otherNetCrossings !== best.otherNetCrossings)
    return candidate.otherNetCrossings < best.otherNetCrossings
  if (!nearlyEqual(candidate.displacement, best.displacement))
    return candidate.displacement < best.displacement
  return candidate.coordinate < best.coordinate
}

const evaluateGroup = ({
  group,
  traces,
  netLabelPlacements,
  obstacles,
}: {
  group: RailSegment[]
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  obstacles: ObstacleRect[]
}): AlignmentCandidate | null => {
  const groupTraceIds = new Set(group.map((segment) => segment.traceId))
  const originalGroupTraces = traces.filter((trace) =>
    groupTraceIds.has(trace.mspPairId),
  )
  const crossAxisSpan =
    Math.max(...group.map((segment) => segment.coordinate)) -
    Math.min(...group.map((segment) => segment.coordinate))
  const alongAxisSpan =
    Math.max(...group.map((segment) => segment.maxAlong)) -
    Math.min(...group.map((segment) => segment.minAlong))
  // Parallel runs that are farther apart than their combined span represent
  // separate routing regions, not a shared visual rail.
  if (crossAxisSpan > alongAxisSpan + EPS) return null
  const baselineCrossings = countOtherNetCrossings(originalGroupTraces, traces)
  const coordinates = [...new Set(group.map((segment) => segment.coordinate))]
  const otherNetTraces = traces.filter(
    (trace) => trace.globalConnNetId !== group[0]!.globalConnNetId,
  )
  const connectorTraces = traces.filter(
    (trace) => trace.traceRole === "net-label-connector",
  )

  let best: AlignmentCandidate | null = null
  for (const coordinate of coordinates) {
    const candidateMap = new Map<string, SolvedTracePath>()
    let pathsAreValid = true

    for (const trace of originalGroupTraces) {
      const traceSegments = group.filter(
        (segment) => segment.traceId === trace.mspPairId,
      )
      const candidateTrace = moveRailSegments(trace, traceSegments, coordinate)
      if (
        !isValidOrthogonalPathWithFixedEndpoints(
          trace.tracePath,
          candidateTrace.tracePath,
        )
      ) {
        pathsAreValid = false
        break
      }
      candidateMap.set(trace.mspPairId, candidateTrace)
    }
    if (!pathsAreValid) continue

    const candidateTraces = [...candidateMap.values()]
    const allCandidateTraces = traces.map(
      (trace) => candidateMap.get(trace.mspPairId) ?? trace,
    )
    const pathLength = candidateTraces.reduce(
      (sum, trace) => sum + getPathLength(trace.tracePath),
      0,
    )

    const candidatesAreClear = candidateTraces.every(
      (candidate) =>
        !isPathCollidingWithObstacles(candidate.tracePath, obstacles) &&
        detectTraceLabelOverlap({
          traces: [candidate],
          netLabels: netLabelPlacements,
        }).length === 0 &&
        !doesPathCoincideWithTraces(candidate.tracePath, otherNetTraces) &&
        !doesPathCoincideWithTraces(
          candidate.tracePath,
          connectorTraces.filter(
            (trace) => trace.mspPairId !== candidate.mspPairId,
          ),
        ),
    )
    if (!candidatesAreClear) continue
    if (
      !preservesExistingLabelAnchors(
        netLabelPlacements,
        traces,
        allCandidateTraces,
      )
    )
      continue

    const otherNetCrossings = countOtherNetCrossings(
      candidateTraces,
      allCandidateTraces,
    )
    if (otherNetCrossings > baselineCrossings) continue

    const candidate: AlignmentCandidate = {
      traces: allCandidateTraces,
      changedTraceIds: candidateTraces
        .filter((trace) => {
          const original = traces.find(
            (item) => item.mspPairId === trace.mspPairId,
          )!
          if (trace.tracePath.length !== original.tracePath.length) return true
          return trace.tracePath.some(
            (point, index) => !pointsEqual(point, original.tracePath[index]!),
          )
        })
        .map((trace) => trace.mspPairId),
      pathLength,
      otherNetCrossings,
      displacement: group.reduce(
        (sum, segment) => sum + Math.abs(segment.coordinate - coordinate),
        0,
      ),
      coordinate,
    }
    if (candidate.changedTraceIds.length === 0) continue
    if (isBetterCandidate(candidate, best)) best = candidate
  }

  return best
}

export const alignTraceRails = ({
  inputProblem,
  traces,
  netLabelPlacements,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}): {
  traces: SolvedTracePath[]
  alignedRailGroupCount: number
  alignedTraceCount: number
} => {
  let outputTraces = [...traces]
  const obstacles = getObstacleRects(inputProblem)
  const alignedTraceIds = new Set<string>()
  let alignedRailGroupCount = 0
  const maximumPasses = Math.max(
    1,
    traces.reduce((sum, trace) => sum + trace.tracePath.length, 0),
  )

  for (let pass = 0; pass < maximumPasses; pass++) {
    const groups = getRailGroups(outputTraces, obstacles)
    let applied: AlignmentCandidate | null = null
    for (const group of groups) {
      applied = evaluateGroup({
        group,
        traces: outputTraces,
        netLabelPlacements,
        obstacles,
      })
      if (applied) break
    }
    if (!applied) break

    outputTraces = applied.traces
    alignedRailGroupCount++
    for (const traceId of applied.changedTraceIds) alignedTraceIds.add(traceId)
  }

  return {
    traces: outputTraces,
    alignedRailGroupCount,
    alignedTraceCount: alignedTraceIds.size,
  }
}
