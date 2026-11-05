import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { ObstacleRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getComponentSideRailSegments } from "./getComponentSideRailSegments"
import { getFixedLabelCoordinate } from "./getFixedLabelCoordinate"
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

  const aPinIds = new Set(traceMap.get(a.traceId)!.pins.map((pin) => pin.pinId))
  return traceMap.get(b.traceId)!.pins.some((pin) => aPinIds.has(pin.pinId))
}

const canJoinRailGroup = (
  start: RailSegment,
  current: RailSegment,
  candidate: RailSegment,
  traceMap: Map<string, SolvedTracePath>,
  obstacles: ObstacleRect[],
  segments: RailSegment[],
  pins: PinIndex,
) =>
  candidate.globalConnNetId === start.globalConnNetId &&
  candidate.orientation === start.orientation &&
  candidate.componentId === start.componentId &&
  candidate.componentFacingDirection === start.componentFacingDirection &&
  // a rail only joins its own trace when the two runs actually lie beside each other;
  // otherwise the pin they share would merge a whole stair-step into one line
  (rangesTouchOrOverlap(current, candidate) ||
    (current.traceId !== candidate.traceId &&
      tracesSharePin(current, candidate, traceMap))) &&
  (current.traceId !== candidate.traceId ||
    !sharedPinWantsForeignRail(current, segments, pins)) &&
  corridorIsClear(current, candidate, obstacles)

const RAIL_EPSILON = 1e-6

interface PinIndex {
  owners: Map<string, Set<string>>
  points: Map<string, { x: number; y: number }>
}

const buildPinIndex = (traces: SolvedTracePath[]): PinIndex => {
  const owners = new Map<string, Set<string>>()
  const points = new Map<string, { x: number; y: number }>()
  for (const trace of traces) {
    for (const pin of trace.pins) {
      points.set(pin.pinId, { x: pin.x, y: pin.y })
      const owned = owners.get(pin.pinId) ?? new Set<string>()
      owned.add(trace.mspPairId)
      owners.set(pin.pinId, owned)
    }
  }
  return { owners, points }
}

const segmentEnds = (segment: RailSegment) =>
  segment.orientation === "horizontal"
    ? [
        { x: segment.minAlong, y: segment.coordinate },
        { x: segment.maxAlong, y: segment.coordinate },
      ]
    : [
        { x: segment.coordinate, y: segment.minAlong },
        { x: segment.coordinate, y: segment.maxAlong },
      ]

const sharedPinAtSegmentEnd = (
  segment: RailSegment,
  pins: PinIndex,
): string | null => {
  for (const end of segmentEnds(segment)) {
    for (const [pinId, point] of pins.points) {
      if ((pins.owners.get(pinId)?.size ?? 0) < 2) continue
      if (
        Math.abs(point.x - end.x) <= RAIL_EPSILON &&
        Math.abs(point.y - end.y) <= RAIL_EPSILON
      ) {
        return pinId
      }
    }
  }
  return null
}

/**
 * True when a pin at the end of this rail is shared with another trace that
 * keeps its own rail somewhere else. The junction solver knows how to reconcile
 * that pair, so the rail pass must not drag this trace onto one of its own runs
 * first — that leaves the two branches leaving the shared pin on different
 * coordinates.
 */
const sharedPinWantsForeignRail = (
  segment: RailSegment,
  segments: RailSegment[],
  pins: PinIndex,
) => {
  const pinId = sharedPinAtSegmentEnd(segment, pins)
  if (!pinId) return false
  const owners = pins.owners.get(pinId)
  if (!owners) return false
  return segments.some(
    (other) =>
      other.orientation === segment.orientation &&
      !owners.has(other.traceId) === false &&
      other.traceId !== segment.traceId &&
      owners.has(other.traceId) &&
      Math.abs(other.coordinate - segment.coordinate) > RAIL_EPSILON,
  )
}

export const getRailGroups = (
  traces: SolvedTracePath[],
  eligibleTraceIds: ReadonlySet<string>,
  inputProblem: InputProblem,
  obstacles: ObstacleRect[],
  netLabelPlacements: NetLabelPlacement[],
): RailSegment[][] => {
  const chipMap = new Map(inputProblem.chips.map((chip) => [chip.chipId, chip]))
  const traceMap = new Map(traces.map((trace) => [trace.mspPairId, trace]))
  const pinIndex = buildPinIndex(traces)
  const eligibleTraces = traces.filter((trace) =>
    eligibleTraceIds.has(trace.mspPairId),
  )

  const collectConnectedGroups = (segments: RailSegment[]) => {
    const visited = new Set<number>()
    const connectedGroups: RailSegment[][] = []

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
          if (
            !canJoinRailGroup(
              start,
              current,
              candidate,
              traceMap,
              obstacles,
              segments,
              pinIndex,
            )
          ) {
            continue
          }

          visited.add(candidateIndex)
          queue.push(candidateIndex)
        }
      }

      connectedGroups.push(group)
    }

    return connectedGroups
  }

  const groupKey = (group: RailSegment[]) =>
    [
      group[0]!.componentId,
      group[0]!.componentFacingDirection,
      group[0]!.orientation,
      ...group
        .map((segment) => `${segment.traceId}:${segment.segmentIndex}`)
        .sort(),
    ].join("|")

  const selectedGroups: RailSegment[][] = []
  const selectedGroupKeys = new Set<string>()
  const addEligibleGroup = (
    group: RailSegment[],
    options?: { requireFixedLabel?: boolean },
  ) => {
    const traceCount = new Set(group.map((segment) => segment.traceId)).size
    if (traceCount < 2) return

    const fixedLabelCoordinate = getFixedLabelCoordinate(
      group,
      netLabelPlacements,
      traces,
    )
    if (options?.requireFixedLabel && fixedLabelCoordinate === null) return

    const hasDifferentCoordinates = group.some(
      (segment) => !nearlyEqual(segment.coordinate, group[0]!.coordinate),
    )
    const hasDifferentFixedLabelCoordinate =
      fixedLabelCoordinate !== null &&
      !nearlyEqual(fixedLabelCoordinate, group[0]!.coordinate)
    if (!hasDifferentCoordinates && !hasDifferentFixedLabelCoordinate) return

    const key = groupKey(group)
    if (selectedGroupKeys.has(key)) return
    selectedGroupKeys.add(key)
    selectedGroups.push(group)
  }

  const primarySegments = eligibleTraces.flatMap((trace) =>
    getComponentSideRailSegments(trace, chipMap),
  )
  // Preserve the original nearest-endpoint grouping and its ordering.
  for (const group of collectConnectedGroups(primarySegments)) {
    addEligibleGroup(group)
  }

  // Equal-distance endpoint associations can bridge a component chain, but
  // only a fixed label is allowed to opt that broader group into alignment.
  const tiedEndpointSegments = eligibleTraces.flatMap((trace) =>
    getComponentSideRailSegments(trace, chipMap, {
      includeTiedEndpointAssociations: true,
      maxMspPairDistance: inputProblem.maxMspPairDistance,
    }),
  )
  for (const group of collectConnectedGroups(tiedEndpointSegments)) {
    addEligibleGroup(group, { requireFixedLabel: true })
  }

  return selectedGroups
}
