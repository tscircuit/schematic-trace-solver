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
) =>
  candidate.globalConnNetId === start.globalConnNetId &&
  candidate.orientation === start.orientation &&
  candidate.componentId === start.componentId &&
  candidate.componentFacingDirection === start.componentFacingDirection &&
  (rangesTouchOrOverlap(current, candidate) ||
    tracesSharePin(current, candidate, traceMap)) &&
  corridorIsClear(current, candidate, obstacles)

interface RailGroupInput {
  traces: SolvedTracePath[]
  eligibleTraceIds: ReadonlySet<string>
  inputProblem: InputProblem
  obstacles: ObstacleRect[]
  netLabelPlacements: NetLabelPlacement[]
}

function* iterateRailGroups(
  {
    traces,
    eligibleTraceIds,
    inputProblem,
    obstacles,
    netLabelPlacements,
  }: RailGroupInput,
  partialGroupsOnly: boolean,
): Generator<RailSegment[]> {
  const chipMap = new Map(inputProblem.chips.map((chip) => [chip.chipId, chip]))
  const traceMap = new Map(traces.map((trace) => [trace.mspPairId, trace]))
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
            !canJoinRailGroup(start, current, candidate, traceMap, obstacles)
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

  const selectedGroupKeys = new Set<string>()
  const acceptEligibleGroup = (
    group: RailSegment[],
    options?: { requireFixedLabel?: boolean },
  ) => {
    const traceCount = new Set(group.map((segment) => segment.traceId)).size
    if (traceCount < 2) return false

    const fixedLabelCoordinate = getFixedLabelCoordinate(
      group,
      netLabelPlacements,
      traces,
    )
    if (options?.requireFixedLabel && fixedLabelCoordinate === null)
      return false

    const hasDifferentCoordinates = group.some(
      (segment) => !nearlyEqual(segment.coordinate, group[0]!.coordinate),
    )
    const hasDifferentFixedLabelCoordinate =
      fixedLabelCoordinate !== null &&
      !nearlyEqual(fixedLabelCoordinate, group[0]!.coordinate)
    if (!hasDifferentCoordinates && !hasDifferentFixedLabelCoordinate)
      return false

    const key = groupKey(group)
    if (selectedGroupKeys.has(key)) return false
    selectedGroupKeys.add(key)
    return true
  }

  const selectGroups = function* (
    groups: RailSegment[][],
    options?: { requireFixedLabel?: boolean },
  ): Generator<RailSegment[]> {
    for (const group of groups) {
      if (!partialGroupsOnly) {
        if (acceptEligibleGroup(group, options)) yield group
        continue
      }

      const traceIds = [...new Set(group.map((segment) => segment.traceId))]
      // Two-trace groups already had their complete alignment evaluated.
      if (traceIds.length < 3) continue

      for (let first = 0; first < traceIds.length - 1; first++) {
        for (let second = first + 1; second < traceIds.length; second++) {
          const pairSegments = group.filter(
            (segment) =>
              segment.traceId === traceIds[first] ||
              segment.traceId === traceIds[second],
          )
          // Removing other traces can remove the bridge between these two.
          // Retain all segments for both trace IDs, then apply the original
          // connectivity rules again rather than assuming the pair connects.
          for (const pairGroup of collectConnectedGroups(pairSegments)) {
            if (acceptEligibleGroup(pairGroup, options)) yield pairGroup
          }
        }
      }
    }
  }

  const primarySegments = eligibleTraces.flatMap((trace) =>
    getComponentSideRailSegments(trace, chipMap),
  )
  // Preserve the original nearest-endpoint grouping and its ordering.
  yield* selectGroups(collectConnectedGroups(primarySegments))

  // Equal-distance endpoint associations can bridge a component chain, but
  // only a fixed label is allowed to opt that broader group into alignment.
  const tiedEndpointSegments = eligibleTraces.flatMap((trace) =>
    getComponentSideRailSegments(trace, chipMap, {
      includeTiedEndpointAssociations: true,
      maxMspPairDistance: inputProblem.maxMspPairDistance,
    }),
  )
  yield* selectGroups(collectConnectedGroups(tiedEndpointSegments), {
    requireFixedLabel: true,
  })
}

export const getRailGroups = (
  traces: SolvedTracePath[],
  eligibleTraceIds: ReadonlySet<string>,
  inputProblem: InputProblem,
  obstacles: ObstacleRect[],
  netLabelPlacements: NetLabelPlacement[],
): RailSegment[][] =>
  Array.from(
    iterateRailGroups(
      {
        traces,
        eligibleTraceIds,
        inputProblem,
        obstacles,
        netLabelPlacements,
      },
      false,
    ),
  )

/**
 * Lazily considers connected two-trace subsets after all complete groups have
 * been rejected. Pair enumeration is bounded quadratically in trace count;
 * each candidate still uses the original component, corridor and label gates.
 */
export const getPartialRailGroups = (
  input: RailGroupInput,
): Generator<RailSegment[]> => iterateRailGroups(input, true)
