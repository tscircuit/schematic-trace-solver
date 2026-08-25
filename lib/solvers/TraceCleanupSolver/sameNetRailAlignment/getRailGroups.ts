import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { ObstacleRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import { getComponentSideRailSegments } from "./getComponentSideRailSegments"
import { nearlyEqual, rangesTouchOrOverlap } from "./geometry"
import type { RailSegment } from "./types"

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

const tracesSharePin = (
  a: RailSegment,
  b: RailSegment,
  traceMap: Map<string, SolvedTracePath>,
) => {
  if (a.traceId === b.traceId) return true

  const aPins = traceMap.get(a.traceId)!.pins
  const bPins = traceMap.get(b.traceId)!.pins
  return aPins.some((aPin) =>
    bPins.some(
      (bPin) => aPin.pinId === bPin.pinId && aPin.chipId === bPin.chipId,
    ),
  )
}

const rangesMeetAtEndpoint = (a: RailSegment, b: RailSegment) =>
  nearlyEqual(a.minAlong, b.maxAlong) || nearlyEqual(a.maxAlong, b.minAlong)

const connectedRailsFormBus = (a: RailSegment, b: RailSegment) => {
  if (!rangesMeetAtEndpoint(a, b)) return false

  const coordinateGap = Math.abs(a.coordinate - b.coordinate)
  const connectedRailSpan =
    Math.max(a.maxAlong, b.maxAlong) - Math.min(a.minAlong, b.minAlong)
  return (
    coordinateGap < connectedRailSpan ||
    nearlyEqual(coordinateGap, connectedRailSpan)
  )
}

const canJoinRailGroup = (
  start: RailSegment,
  current: RailSegment,
  candidate: RailSegment,
  traceMap: Map<string, SolvedTracePath>,
  obstacles: ObstacleRect[],
) => {
  const sameComponentSide = candidate.componentId === start.componentId
  const tracesConnect = tracesSharePin(current, candidate, traceMap)
  const componentBusConnects =
    tracesConnect && connectedRailsFormBus(current, candidate)

  return (
    candidate.globalConnNetId === start.globalConnNetId &&
    candidate.orientation === start.orientation &&
    candidate.componentFacingDirection === start.componentFacingDirection &&
    (sameComponentSide || componentBusConnects) &&
    (rangesTouchOrOverlap(current, candidate) || tracesConnect) &&
    corridorIsClear(current, candidate, obstacles)
  )
}

export const getRailGroups = (
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

  for (let startIndex = 0; startIndex < segments.length; startIndex++) {
    if (visited.has(startIndex)) continue

    const start = segments[startIndex]!
    const queue = [startIndex]
    const group: RailSegment[] = []
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
        if (!canJoinRailGroup(start, current, candidate, traceMap, obstacles)) {
          continue
        }

        visited.add(candidateIndex)
        queue.push(candidateIndex)
      }
    }

    // Mixed groups fall back to their original component-side groups.
    const componentGroups: RailSegment[][] = []
    for (const segment of group) {
      const componentGroup = componentGroups.find(
        (candidateGroup) =>
          candidateGroup[0]!.componentId === segment.componentId,
      )
      if (componentGroup) componentGroup.push(segment)
      else componentGroups.push([segment])
    }
    let candidateGroups = componentGroups
    if (componentGroups.length === group.length) candidateGroups = [group]

    for (const candidateGroup of candidateGroups) {
      const traceCount = new Set(
        candidateGroup.map((segment) => segment.traceId),
      ).size
      const hasDifferentCoordinates = candidateGroup.some(
        (segment) =>
          !nearlyEqual(segment.coordinate, candidateGroup[0]!.coordinate),
      )
      if (traceCount >= 2 && hasDifferentCoordinates) {
        groups.push(candidateGroup)
      }
    }
  }

  return groups
}
