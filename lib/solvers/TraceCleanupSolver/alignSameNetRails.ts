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
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import type { InputChip, InputPin, InputProblem } from "lib/types/InputProblem"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import { simplifyPath } from "./simplifyPath"

const EPS = 2e-3

type RailOrientation = "horizontal" | "vertical"
type ComponentSide = "left" | "right" | "top" | "bottom"

type RailSegment = {
  traceId: string
  segmentIndex: number
  globalConnNetId: string
  orientation: RailOrientation
  coordinate: number
  minAlong: number
  maxAlong: number
  componentId: string
  componentSide: ComponentSide
}

type AlignmentScore = {
  railCount: number
  turnCount: number
  visibleLength: number
  logicalLength: number
  otherNetCrossings: number
  displacement: number
  coordinate: number
}

type AlignmentCandidate = {
  traces: SolvedTracePath[]
  changedTraceIds: string[]
  score: AlignmentScore
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

const getMovableRailSegments = (trace: SolvedTracePath) => {
  const segments: Omit<RailSegment, "componentId" | "componentSide">[] = []
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

const getPinSide = (pin: InputPin, chip: InputChip): ComponentSide => {
  if (pin._facingDirection === "x-") return "left"
  if (pin._facingDirection === "x+") return "right"
  if (pin._facingDirection === "y+") return "top"
  if (pin._facingDirection === "y-") return "bottom"

  const bounds = {
    left: chip.center.x - chip.width / 2,
    right: chip.center.x + chip.width / 2,
    top: chip.center.y + chip.height / 2,
    bottom: chip.center.y - chip.height / 2,
  }
  const distances: Array<[ComponentSide, number]> = [
    ["left", Math.abs(pin.x - bounds.left)],
    ["right", Math.abs(pin.x - bounds.right)],
    ["top", Math.abs(pin.y - bounds.top)],
    ["bottom", Math.abs(pin.y - bounds.bottom)],
  ]
  distances.sort((a, b) => a[1] - b[1])
  return distances[0]![0]
}

const railIsOutsideComponentSide = (
  segment: Omit<RailSegment, "componentId" | "componentSide">,
  chip: InputChip,
  side: ComponentSide,
) => {
  const minX = chip.center.x - chip.width / 2
  const maxX = chip.center.x + chip.width / 2
  const minY = chip.center.y - chip.height / 2
  const maxY = chip.center.y + chip.height / 2

  if (side === "left")
    return (
      segment.orientation === "vertical" && segment.coordinate <= minX + EPS
    )
  if (side === "right")
    return (
      segment.orientation === "vertical" && segment.coordinate >= maxX - EPS
    )
  if (side === "top")
    return (
      segment.orientation === "horizontal" && segment.coordinate >= maxY - EPS
    )
  return (
    segment.orientation === "horizontal" && segment.coordinate <= minY + EPS
  )
}

/**
 * Associate internal rails with the component side they route around. A rail
 * can be split into several collinear runs by an earlier collision detour, so
 * every qualifying run is retained and moved as one cleanup operation.
 * Generated label connectors are excluded by eligibleTraceIds before this
 * function runs.
 */
const getComponentSideRailSegments = (
  trace: SolvedTracePath,
  chipMap: Map<string, InputChip>,
): RailSegment[] => {
  const movableSegments = getMovableRailSegments(trace)
  const segments: RailSegment[] = []

  for (const segment of movableSegments) {
    const associations = trace.pins.flatMap((pin, pinIndex) => {
      const chip = chipMap.get(pin.chipId)
      if (!chip) return []
      const componentSide = getPinSide(pin, chip)
      if (!railIsOutsideComponentSide(segment, chip, componentSide)) return []
      return [
        {
          componentId: chip.chipId,
          componentSide,
          distanceFromEndpoint:
            pinIndex === 0
              ? segment.segmentIndex
              : trace.tracePath.length - 2 - segment.segmentIndex,
        },
      ]
    })
    associations.sort((a, b) => a.distanceFromEndpoint - b.distanceFromEndpoint)
    const association = associations[0]
    if (!association) continue
    segments.push({
      ...segment,
      componentId: association.componentId,
      componentSide: association.componentSide,
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
  if (!rangesTouchOrOverlap(a, b)) return true
  const [start, end] = getCorridor(a, b)
  return !obstacles.some((obstacle) =>
    segmentIntersectsRect(start, end, obstacle),
  )
}

const getRailGroups = (
  traces: SolvedTracePath[],
  eligibleTraceIds: ReadonlySet<string>,
  inputProblem: InputProblem,
  obstacles: ObstacleRect[],
): RailSegment[][] => {
  const chipMap = new Map(inputProblem.chips.map((chip) => [chip.chipId, chip]))
  const segments = traces
    .filter((trace) => eligibleTraceIds.has(trace.mspPairId))
    .flatMap((trace) => getComponentSideRailSegments(trace, chipMap))
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
          candidate.componentId !== start.componentId ||
          candidate.componentSide !== start.componentSide ||
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
      group.some(
        (segment) => !nearlyEqual(segment.coordinate, group[0]!.coordinate),
      )
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

const getDistinctCoordinates = (coordinates: number[]) => {
  const distinct: number[] = []
  for (const coordinate of coordinates) {
    if (!distinct.some((item) => nearlyEqual(item, coordinate))) {
      distinct.push(coordinate)
    }
  }
  return distinct
}

type Interval = { coordinate: number; min: number; max: number }

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
      if (interval.min <= currentMax + EPS) {
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

/** Length of the rendered same-net geometry after overlapping runs are merged. */
const getVisibleLength = (traces: SolvedTracePath[]) => {
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

const getTurnCount = (traces: SolvedTracePath[]) =>
  traces.reduce(
    (total, trace) => total + Math.max(0, trace.tracePath.length - 2),
    0,
  )

const scoreIsBetter = (candidate: AlignmentScore, best: AlignmentScore) => {
  if (candidate.railCount !== best.railCount)
    return candidate.railCount < best.railCount
  if (candidate.turnCount !== best.turnCount)
    return candidate.turnCount < best.turnCount
  if (!nearlyEqual(candidate.visibleLength, best.visibleLength))
    return candidate.visibleLength < best.visibleLength
  if (!nearlyEqual(candidate.logicalLength, best.logicalLength))
    return candidate.logicalLength < best.logicalLength
  if (candidate.otherNetCrossings !== best.otherNetCrossings)
    return candidate.otherNetCrossings < best.otherNetCrossings
  if (!nearlyEqual(candidate.displacement, best.displacement))
    return candidate.displacement < best.displacement
  return candidate.coordinate < best.coordinate
}

const isReadabilityImprovement = (
  candidate: AlignmentScore,
  baseline: AlignmentScore,
) =>
  candidate.railCount < baseline.railCount &&
  candidate.turnCount <= baseline.turnCount &&
  (candidate.turnCount < baseline.turnCount ||
    candidate.visibleLength <= baseline.visibleLength + EPS)

const evaluateGroup = ({
  group,
  traces,
  netLabelPlacements,
  obstacles,
  eligibleTraceIds,
}: {
  group: RailSegment[]
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  obstacles: ObstacleRect[]
  eligibleTraceIds: ReadonlySet<string>
}): AlignmentCandidate | null => {
  const groupTraceIds = new Set(group.map((segment) => segment.traceId))
  const originalGroupTraces = traces.filter((trace) =>
    groupTraceIds.has(trace.mspPairId),
  )
  const baselineCrossings = countOtherNetCrossings(originalGroupTraces, traces)
  const baseline: AlignmentScore = {
    railCount: getDistinctCoordinates(
      group.map((segment) => segment.coordinate),
    ).length,
    turnCount: getTurnCount(originalGroupTraces),
    visibleLength: getVisibleLength(originalGroupTraces),
    logicalLength: originalGroupTraces.reduce(
      (sum, trace) => sum + getPathLength(trace.tracePath),
      0,
    ),
    otherNetCrossings: baselineCrossings,
    displacement: 0,
    coordinate: Number.NEGATIVE_INFINITY,
  }
  const coordinates = getDistinctCoordinates(
    group.map((segment) => segment.coordinate),
  )
  const otherNetTraces = traces.filter(
    (trace) => trace.globalConnNetId !== group[0]!.globalConnNetId,
  )
  const immutableTraces = traces.filter(
    (trace) => !eligibleTraceIds.has(trace.mspPairId),
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
          immutableTraces.filter(
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

    const score: AlignmentScore = {
      railCount: 1,
      turnCount: getTurnCount(candidateTraces),
      visibleLength: getVisibleLength(candidateTraces),
      logicalLength: candidateTraces.reduce(
        (sum, trace) => sum + getPathLength(trace.tracePath),
        0,
      ),
      otherNetCrossings,
      displacement: group.reduce(
        (sum, segment) => sum + Math.abs(segment.coordinate - coordinate),
        0,
      ),
      coordinate,
    }
    if (!isReadabilityImprovement(score, baseline)) continue

    const changedTraceIds = candidateTraces
      .filter((trace) => {
        const original = traces.find(
          (item) => item.mspPairId === trace.mspPairId,
        )!
        if (trace.tracePath.length !== original.tracePath.length) return true
        return trace.tracePath.some(
          (point, index) => !pointsEqual(point, original.tracePath[index]!),
        )
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

export const alignSameNetRails = ({
  inputProblem,
  traces,
  netLabelPlacements,
  eligibleTraceIds,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  eligibleTraceIds: ReadonlySet<string>
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
    const groups = getRailGroups(
      outputTraces,
      eligibleTraceIds,
      inputProblem,
      obstacles,
    )
    let applied: AlignmentCandidate | null = null
    for (const group of groups) {
      applied = evaluateGroup({
        group,
        traces: outputTraces,
        netLabelPlacements,
        obstacles,
        eligibleTraceIds,
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
