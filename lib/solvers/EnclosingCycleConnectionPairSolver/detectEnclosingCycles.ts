import {
  doSegmentsIntersect,
  isPointInsidePolygon,
  onSegment,
} from "@tscircuit/math-utils"
import type { ConnectivityMap } from "connectivity-map"
import type {
  ChipId,
  InputDirectConnection,
  InputPin,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"

const GEOMETRY_TOLERANCE = 1e-6
const BOUNDARY_COMPONENT_COUNT = 4

type Point = { x: number; y: number }
type PinWithChip = InputPin & { chipId: ChipId }

interface ComponentGraphEdge {
  connection: InputDirectConnection
  firstChipId: ChipId
  secondChipId: ChipId
}

interface CycleCandidate extends DetectedEnclosingCycle {
  area: number
  polygon: Point[]
}

export interface DetectedEnclosingCycle {
  boundaryChipIds: ChipId[]
  innerChipIds: ChipId[]
  edgeConnections: InputDirectConnection[]
}

const getOtherChipId = (edge: ComponentGraphEdge, chipId: ChipId) =>
  edge.firstChipId === chipId ? edge.secondChipId : edge.firstChipId

const getUndirectedPairKey = (firstId: ChipId, secondId: ChipId) =>
  [firstId, secondId].sort().join("::")

const getCanonicalCycleKey = (chipIds: ChipId[]) => {
  const orderings: string[] = []
  for (const orderedIds of [chipIds, [...chipIds].reverse()]) {
    for (let offset = 0; offset < orderedIds.length; offset++) {
      orderings.push(
        [...orderedIds.slice(offset), ...orderedIds.slice(0, offset)].join(
          "::",
        ),
      )
    }
  }
  return orderings.sort()[0]!
}

const getPolygonArea = (polygon: Point[]) => {
  let twiceArea = 0
  for (let index = 0; index < polygon.length; index++) {
    const point = polygon[index]!
    const nextPoint = polygon[(index + 1) % polygon.length]!
    twiceArea += point.x * nextPoint.y - nextPoint.x * point.y
  }
  return Math.abs(twiceArea) / 2
}

const isPointStrictlyInsidePolygon = (point: Point, polygon: Point[]) =>
  isPointInsidePolygon(point, polygon) &&
  !polygon.some((start, index) =>
    onSegment(start, point, polygon[(index + 1) % polygon.length]!),
  )

const isSimplePolygon = (polygon: Point[]) => {
  for (let firstIndex = 0; firstIndex < polygon.length; firstIndex++) {
    const firstNextIndex = (firstIndex + 1) % polygon.length
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < polygon.length;
      secondIndex++
    ) {
      const secondNextIndex = (secondIndex + 1) % polygon.length
      const edgesAreAdjacent =
        firstIndex === secondIndex ||
        firstNextIndex === secondIndex ||
        secondNextIndex === firstIndex
      if (edgesAreAdjacent) continue

      if (
        doSegmentsIntersect(
          polygon[firstIndex]!,
          polygon[firstNextIndex]!,
          polygon[secondIndex]!,
          polygon[secondNextIndex]!,
        )
      ) {
        return false
      }
    }
  }
  return true
}

const getComponentGraph = (inputProblem: InputProblem) => {
  const pinMap = new Map<PinId, PinWithChip>()
  for (const chip of inputProblem.chips) {
    for (const pin of chip.pins) {
      pinMap.set(pin.pinId, { ...pin, chipId: chip.chipId })
    }
  }

  const adjacency = new Map<ChipId, ComponentGraphEdge[]>()
  const edgeByChipPair = new Map<string, ComponentGraphEdge>()
  for (const connection of inputProblem.directConnections) {
    const firstPin = pinMap.get(connection.pinIds[0])
    const secondPin = pinMap.get(connection.pinIds[1])
    if (!firstPin || !secondPin || firstPin.chipId === secondPin.chipId) {
      continue
    }

    const pairKey = getUndirectedPairKey(firstPin.chipId, secondPin.chipId)
    if (edgeByChipPair.has(pairKey)) continue
    const edge = {
      connection,
      firstChipId: firstPin.chipId,
      secondChipId: secondPin.chipId,
    }
    edgeByChipPair.set(pairKey, edge)
    adjacency.set(firstPin.chipId, [
      ...(adjacency.get(firstPin.chipId) ?? []),
      edge,
    ])
    adjacency.set(secondPin.chipId, [
      ...(adjacency.get(secondPin.chipId) ?? []),
      edge,
    ])
  }

  return { adjacency, edgeByChipPair }
}

const enumerateChordlessCycles = (inputProblem: InputProblem) => {
  const { adjacency, edgeByChipPair } = getComponentGraph(inputProblem)
  const cycleKeys = new Set<string>()
  const cycles: Array<{
    boundaryChipIds: ChipId[]
    edgeConnections: InputDirectConnection[]
  }> = []

  const visit = (
    startChipId: ChipId,
    currentChipId: ChipId,
    pathChipIds: ChipId[],
    pathEdges: ComponentGraphEdge[],
    visitedChipIds: Set<ChipId>,
  ) => {
    for (const edge of adjacency.get(currentChipId) ?? []) {
      const nextChipId = getOtherChipId(edge, currentChipId)
      if (nextChipId === startChipId) {
        if (pathChipIds.length !== BOUNDARY_COMPONENT_COUNT) continue
        const cycleKey = getCanonicalCycleKey(pathChipIds)
        if (cycleKeys.has(cycleKey)) continue
        cycleKeys.add(cycleKey)
        cycles.push({
          boundaryChipIds: [...pathChipIds],
          edgeConnections: [
            ...pathEdges.map((pathEdge) => pathEdge.connection),
            edge.connection,
          ],
        })
        continue
      }
      if (
        visitedChipIds.has(nextChipId) ||
        pathChipIds.length >= BOUNDARY_COMPONENT_COUNT ||
        nextChipId.localeCompare(startChipId) < 0
      ) {
        continue
      }

      const hasChord = pathChipIds
        .slice(1, -1)
        .some((chipId) =>
          edgeByChipPair.has(getUndirectedPairKey(chipId, nextChipId)),
        )
      if (hasChord) continue

      visitedChipIds.add(nextChipId)
      visit(
        startChipId,
        nextChipId,
        [...pathChipIds, nextChipId],
        [...pathEdges, edge],
        visitedChipIds,
      )
      visitedChipIds.delete(nextChipId)
    }
  }

  for (const startChipId of [...adjacency.keys()].sort()) {
    visit(startChipId, startChipId, [startChipId], [], new Set([startChipId]))
  }
  return cycles
}

/**
 * Detect four-component connection cycles that spatially enclose a branch,
 * regardless of the loop's dimensions, alignment, or pin directions.
 */
export const detectEnclosingCycles = (
  inputProblem: InputProblem,
  globalConnMap: ConnectivityMap,
): DetectedEnclosingCycle[] => {
  const chipMap = new Map(inputProblem.chips.map((chip) => [chip.chipId, chip]))
  const chipIdByPinId = new Map<PinId, ChipId>()
  for (const chip of inputProblem.chips) {
    for (const pin of chip.pins) chipIdByPinId.set(pin.pinId, chip.chipId)
  }
  const candidates: CycleCandidate[] = []

  for (const cycle of enumerateChordlessCycles(inputProblem)) {
    const polygon = cycle.boundaryChipIds.map(
      (chipId) => chipMap.get(chipId)!.center,
    )
    const area = getPolygonArea(polygon)
    if (area <= GEOMETRY_TOLERANCE || !isSimplePolygon(polygon)) continue

    const boundaryChipIds = new Set(cycle.boundaryChipIds)
    const boundaryPinIdsByChip = new Map<ChipId, Set<PinId>>()
    for (const connection of cycle.edgeConnections) {
      for (const pinId of connection.pinIds) {
        const chipId = chipIdByPinId.get(pinId)
        if (!chipId || !boundaryChipIds.has(chipId)) continue
        const pinIds = boundaryPinIdsByChip.get(chipId) ?? new Set<PinId>()
        pinIds.add(pinId)
        boundaryPinIdsByChip.set(chipId, pinIds)
      }
    }
    const hasTwoDistinctBoundaryPinsAtEveryCorner = cycle.boundaryChipIds.every(
      (chipId) => boundaryPinIdsByChip.get(chipId)?.size === 2,
    )
    if (!hasTwoDistinctBoundaryPinsAtEveryCorner) continue

    const innerChipIds = inputProblem.chips
      .filter(
        (chip) =>
          !boundaryChipIds.has(chip.chipId) &&
          isPointStrictlyInsidePolygon(chip.center, polygon),
      )
      .map((chip) => chip.chipId)
    if (innerChipIds.length === 0) continue

    const innerChipIdSet = new Set(innerChipIds)
    const boundaryNetIds = new Set(
      cycle.edgeConnections
        .map((connection) =>
          globalConnMap.getNetConnectedToId(connection.pinIds[0]),
        )
        .filter((netId): netId is string => netId !== undefined),
    )
    const innerConnectionsByChipPair = new Map<
      string,
      InputDirectConnection[]
    >()
    for (const connection of inputProblem.directConnections) {
      const firstChipId = chipIdByPinId.get(connection.pinIds[0])
      const secondChipId = chipIdByPinId.get(connection.pinIds[1])
      if (
        !firstChipId ||
        !secondChipId ||
        firstChipId === secondChipId ||
        !innerChipIdSet.has(firstChipId) ||
        !innerChipIdSet.has(secondChipId)
      ) {
        continue
      }
      const pairKey = getUndirectedPairKey(firstChipId, secondChipId)
      innerConnectionsByChipPair.set(pairKey, [
        ...(innerConnectionsByChipPair.get(pairKey) ?? []),
        connection,
      ])
    }
    const hasNestedTwoNetBranch = [...innerConnectionsByChipPair.values()].some(
      (connections) => {
        const connectedBoundaryNetIds = new Set(
          connections
            .map((connection) =>
              globalConnMap.getNetConnectedToId(connection.pinIds[0]),
            )
            .filter(
              (netId): netId is string =>
                netId !== undefined && boundaryNetIds.has(netId),
            ),
        )
        return connectedBoundaryNetIds.size >= 2
      },
    )
    if (!hasNestedTwoNetBranch) continue

    candidates.push({ ...cycle, innerChipIds, area, polygon })
  }

  const outermostCycles: CycleCandidate[] = []
  for (const candidate of candidates.sort((first, second) => {
    const areaDifference = second.area - first.area
    if (Math.abs(areaDifference) > GEOMETRY_TOLERANCE) return areaDifference
    return getCanonicalCycleKey(first.boundaryChipIds).localeCompare(
      getCanonicalCycleKey(second.boundaryChipIds),
    )
  })) {
    const isNested = outermostCycles.some((outerCycle) =>
      candidate.polygon.every((point) =>
        isPointInsidePolygon(point, outerCycle.polygon),
      ),
    )
    if (!isNested) outermostCycles.push(candidate)
  }

  return outermostCycles.map(
    ({ boundaryChipIds, innerChipIds, edgeConnections }) => ({
      boundaryChipIds,
      innerChipIds,
      edgeConnections,
    }),
  )
}
