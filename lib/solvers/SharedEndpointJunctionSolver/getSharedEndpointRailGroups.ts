import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getComponentSideRailSegments } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/getComponentSideRailSegments"
import {
  nearlyEqual,
  rangesTouchOrOverlap,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { RailSegment } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/types"
import type { InputProblem } from "lib/types/InputProblem"

const SHARED_PIN_RAIL_JOIN_DISTANCE = 0.05
const MIN_EXPANDED_DETOUR_PATH_POINTS = 6

const getPinKey = (pin: SolvedTracePath["pins"][number]) =>
  `${pin.chipId}::${pin.pinId}`

const rangesOverlap = (
  rangeA: { start: number; end: number },
  rangeB: { start: number; end: number },
) =>
  Math.min(
    Math.max(rangeA.start, rangeA.end),
    Math.max(rangeB.start, rangeB.end),
  ) >
  Math.max(
    Math.min(rangeA.start, rangeA.end),
    Math.min(rangeB.start, rangeB.end),
  )

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

const terminalSegmentsOverlapAtSharedPin = ({
  traceA,
  traceB,
  sharedPinKey,
}: {
  traceA: SolvedTracePath
  traceB: SolvedTracePath
  sharedPinKey: string
}) => {
  const segmentA = getTerminalSegmentAtPin(traceA, sharedPinKey)
  const segmentB = getTerminalSegmentAtPin(traceB, sharedPinKey)
  if (!segmentA || !segmentB) return false

  const [aStart, aEnd] = segmentA
  const [bStart, bEnd] = segmentB
  const areCollinearHorizontal =
    nearlyEqual(aStart.y, aEnd.y) &&
    nearlyEqual(bStart.y, bEnd.y) &&
    nearlyEqual(aStart.y, bStart.y)
  if (areCollinearHorizontal) {
    return rangesOverlap(
      { start: aStart.x, end: aEnd.x },
      { start: bStart.x, end: bEnd.x },
    )
  }

  const areCollinearVertical =
    nearlyEqual(aStart.x, aEnd.x) &&
    nearlyEqual(bStart.x, bEnd.x) &&
    nearlyEqual(aStart.x, bStart.x)
  if (areCollinearVertical) {
    return rangesOverlap(
      { start: aStart.y, end: aEnd.y },
      { start: bStart.y, end: bEnd.y },
    )
  }

  return false
}

const connectSameComponentPair = (
  traceA: SolvedTracePath,
  traceB: SolvedTracePath,
) => {
  const traceAChipIds = [
    ...new Set(traceA.pins.map((pin) => pin.chipId)),
  ].sort()
  const traceBChipIds = [
    ...new Set(traceB.pins.map((pin) => pin.chipId)),
  ].sort()
  return (
    traceAChipIds.length === traceBChipIds.length &&
    traceAChipIds.every((chipId, index) => chipId === traceBChipIds[index])
  )
}

const getSharedPinKey = (traceA: SolvedTracePath, traceB: SolvedTracePath) => {
  const traceBPinKeys = new Set(traceB.pins.map(getPinKey))
  return traceA.pins.map(getPinKey).find((pinKey) => traceBPinKeys.has(pinKey))
}

const canFormSharedEndpointJunction = ({
  segmentA,
  segmentB,
  traceA,
  traceB,
}: {
  segmentA: RailSegment
  segmentB: RailSegment
  traceA: SolvedTracePath
  traceB: SolvedTracePath
}) => {
  if (
    segmentA.globalConnNetId !== segmentB.globalConnNetId ||
    segmentA.orientation !== segmentB.orientation ||
    nearlyEqual(segmentA.coordinate, segmentB.coordinate) ||
    !rangesTouchOrOverlap(segmentA, segmentB)
  ) {
    return false
  }

  // Join a generated detour to a simpler neighboring branch, not two like paths.
  const traceAIsExpandedDetour =
    traceA.tracePath.length >= MIN_EXPANDED_DETOUR_PATH_POINTS
  const traceBIsExpandedDetour =
    traceB.tracePath.length >= MIN_EXPANDED_DETOUR_PATH_POINTS
  if (traceAIsExpandedDetour === traceBIsExpandedDetour) return false

  // Keep parallel routes between the same component pair independent.
  if (connectSameComponentPair(traceA, traceB)) return false

  const sharedPinKey = getSharedPinKey(traceA, traceB)
  if (!sharedPinKey) return false

  return (
    Math.abs(segmentA.coordinate - segmentB.coordinate) <=
      SHARED_PIN_RAIL_JOIN_DISTANCE ||
    terminalSegmentsOverlapAtSharedPin({ traceA, traceB, sharedPinKey })
  )
}

export const getSharedEndpointRailGroups = ({
  traces,
  eligibleTraceIds,
  inputProblem,
}: {
  traces: SolvedTracePath[]
  eligibleTraceIds: ReadonlySet<string>
  inputProblem: InputProblem
}): RailSegment[][] => {
  const chipMap = new Map(inputProblem.chips.map((chip) => [chip.chipId, chip]))
  const traceMap = new Map(
    traces
      .filter((trace) => eligibleTraceIds.has(trace.mspPairId))
      .map((trace) => [trace.mspPairId, trace]),
  )
  const segments = [...traceMap.values()].flatMap((trace) =>
    getComponentSideRailSegments(trace, chipMap),
  )
  const groups: RailSegment[][] = []

  for (let aIndex = 0; aIndex < segments.length; aIndex++) {
    const segmentA = segments[aIndex]!
    const traceA = traceMap.get(segmentA.traceId)!

    for (let bIndex = aIndex + 1; bIndex < segments.length; bIndex++) {
      const segmentB = segments[bIndex]!
      if (segmentA.traceId === segmentB.traceId) continue
      const traceB = traceMap.get(segmentB.traceId)!

      if (
        !canFormSharedEndpointJunction({
          segmentA,
          segmentB,
          traceA,
          traceB,
        })
      )
        continue

      groups.push([segmentA, segmentB])
    }
  }

  return groups
}
