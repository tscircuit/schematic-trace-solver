import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { ObstacleRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import { getComponentSideRailSegments } from "./getComponentSideRailSegments"
import { nearlyEqual, rangesTouchOrOverlap } from "./geometry"
import type { RailSegment } from "./types"

const SHARED_PIN_RAIL_JOIN_DISTANCE = 0.05

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

const getPinKey = (pin: SolvedTracePath["pins"][number]) =>
  `${pin.chipId}::${pin.pinId}`

const tracesSharePin = (
  a: RailSegment,
  b: RailSegment,
  traceMap: Map<string, SolvedTracePath>,
) => {
  const aPinKeys = new Set(traceMap.get(a.traceId)!.pins.map(getPinKey))
  return traceMap
    .get(b.traceId)!
    .pins.some((pin) => aPinKeys.has(getPinKey(pin)))
}

const getTerminalSegmentAtPin = (
  trace: SolvedTracePath,
  pinKey: string,
): [Point, Point] | null => {
  const pinIndex = trace.pins.findIndex((pin) => getPinKey(pin) === pinKey)
  if (pinIndex === 0) return [trace.tracePath[0]!, trace.tracePath[1]!]
  if (pinIndex === trace.pins.length - 1) {
    return [
      trace.tracePath[trace.tracePath.length - 2]!,
      trace.tracePath[trace.tracePath.length - 1]!,
    ]
  }
  return null
}

const sharedPinTerminalSegmentsOverlap = (
  a: RailSegment,
  b: RailSegment,
  traceMap: Map<string, SolvedTracePath>,
) => {
  if (a.traceId === b.traceId) return true

  const traceA = traceMap.get(a.traceId)!
  const traceB = traceMap.get(b.traceId)!
  // Shared-pin junction alignment repairs the transition between one expanded
  // endpoint detour and one normal neighboring branch. Two normal branches
  // already have an intentional layout, while moving one of two expanded
  // detours can pull its outer rail back toward an endpoint component.
  const traceAIsExpandedDetour = traceA.tracePath.length >= 6
  const traceBIsExpandedDetour = traceB.tracePath.length >= 6
  if (traceAIsExpandedDetour === traceBIsExpandedDetour) return false
  const traceAChipIds = [
    ...new Set(traceA.pins.map((pin) => pin.chipId)),
  ].sort()
  const traceBChipIds = [
    ...new Set(traceB.pins.map((pin) => pin.chipId)),
  ].sort()
  const connectSameComponentPair =
    traceAChipIds.length === traceBChipIds.length &&
    traceAChipIds.every((chipId, index) => chipId === traceBChipIds[index])
  if (connectSameComponentPair) return false

  const traceBPinKeys = new Set(traceB.pins.map(getPinKey))
  const sharedPinKey = traceA.pins
    .map(getPinKey)
    .find((pinKey) => traceBPinKeys.has(pinKey))
  if (!sharedPinKey) return false

  const segmentA = getTerminalSegmentAtPin(traceA, sharedPinKey)
  const segmentB = getTerminalSegmentAtPin(traceB, sharedPinKey)
  if (!segmentA || !segmentB) return false

  const [aStart, aEnd] = segmentA
  const [bStart, bEnd] = segmentB
  const bothHorizontal =
    nearlyEqual(aStart.y, aEnd.y) &&
    nearlyEqual(bStart.y, bEnd.y) &&
    nearlyEqual(aStart.y, bStart.y)
  const bothVertical =
    nearlyEqual(aStart.x, aEnd.x) &&
    nearlyEqual(bStart.x, bEnd.x) &&
    nearlyEqual(aStart.x, bStart.x)
  if (!bothHorizontal && !bothVertical) return false

  const overlapLength = bothHorizontal
    ? Math.min(Math.max(aStart.x, aEnd.x), Math.max(bStart.x, bEnd.x)) -
      Math.max(Math.min(aStart.x, aEnd.x), Math.min(bStart.x, bEnd.x))
    : Math.min(Math.max(aStart.y, aEnd.y), Math.max(bStart.y, bEnd.y)) -
      Math.max(Math.min(aStart.y, aEnd.y), Math.min(bStart.y, bEnd.y))

  return overlapLength > 0
}

const canJoinRailGroup = (
  start: RailSegment,
  current: RailSegment,
  candidate: RailSegment,
  traceMap: Map<string, SolvedTracePath>,
  obstacles: ObstacleRect[],
) => {
  const haveOverlappingSharedPinTerminals =
    (tracesSharePin(current, candidate, traceMap) &&
      Math.abs(current.coordinate - candidate.coordinate) <=
        SHARED_PIN_RAIL_JOIN_DISTANCE) ||
    sharedPinTerminalSegmentsOverlap(current, candidate, traceMap)
  const areOnSameComponentSide =
    candidate.componentId === start.componentId &&
    candidate.componentFacingDirection === start.componentFacingDirection

  return (
    candidate.globalConnNetId === start.globalConnNetId &&
    candidate.orientation === start.orientation &&
    (haveOverlappingSharedPinTerminals ||
      (areOnSameComponentSide && rangesTouchOrOverlap(current, candidate))) &&
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
  const collectGroups = (): RailSegment[][] => {
    const segmentsForMode = segments
    const visited = new Set<number>()
    const groups: RailSegment[][] = []

    for (
      let startIndex = 0;
      startIndex < segmentsForMode.length;
      startIndex++
    ) {
      if (visited.has(startIndex)) continue

      const start = segmentsForMode[startIndex]!
      const queue = [startIndex]
      const group: RailSegment[] = []
      visited.add(startIndex)

      for (let queueIndex = 0; queueIndex < queue.length; queueIndex++) {
        const current = segmentsForMode[queue[queueIndex]!]!
        group.push(current)

        for (
          let candidateIndex = 0;
          candidateIndex < segmentsForMode.length;
          candidateIndex++
        ) {
          if (visited.has(candidateIndex)) continue
          const candidate = segmentsForMode[candidateIndex]!
          if (
            !canJoinRailGroup(start, current, candidate, traceMap, obstacles)
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
      if (traceCount >= 2 && hasDifferentCoordinates) groups.push(group)
    }

    return groups
  }

  return collectGroups()
}
