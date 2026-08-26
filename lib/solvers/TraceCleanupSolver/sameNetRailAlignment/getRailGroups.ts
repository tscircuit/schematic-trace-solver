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

const MIN_UNLABELED_RAIL_CHAIN_TRACE_COUNT = 3
const SINGLE_RAIL_TRACE_POINT_COUNT = 4

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

export const getRailGroups = (
  traces: SolvedTracePath[],
  eligibleTraceIds: ReadonlySet<string>,
  inputProblem: InputProblem,
  obstacles: ObstacleRect[],
  netLabelPlacements: NetLabelPlacement[],
): RailSegment[][] => {
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
    const groupTraceIds = new Set(group.map((segment) => segment.traceId))
    const groupIsUnlabeledRailChain =
      groupTraceIds.size >= MIN_UNLABELED_RAIL_CHAIN_TRACE_COUNT &&
      group.every(
        (segment) =>
          traceMap.get(segment.traceId)?.tracePath.length ===
          SINGLE_RAIL_TRACE_POINT_COUNT,
      )
    if (groupIsUnlabeledRailChain) {
      addEligibleGroup(group)
      continue
    }
    addEligibleGroup(group, { requireFixedLabel: true })
  }

  return selectedGroups
}
