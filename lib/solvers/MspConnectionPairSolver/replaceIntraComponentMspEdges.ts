import type {
  InputChip,
  InputPin,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import { arePinsInDifferentSchematicSections } from "lib/utils/arePinsInDifferentSchematicSections"
import { doesPairCrossRestrictedCenterLines } from "./doesPairCrossRestrictedCenterLines"

type PinWithChip = InputPin & { chipId: string }
type MspEdge = [PinId, PinId]
const MIN_HUB_DEGREE_WITH_LOCAL_EDGE = 3
const CHIP_EDGE_TOLERANCE = 1e-6

interface ReplacementCandidate {
  edge: MspEdge
  distance: number
  lowerPinId: PinId
  upperPinId: PinId
}

const getConnectedPinIds = ({
  startPinId,
  edges,
}: {
  startPinId: PinId
  edges: MspEdge[]
}) => {
  const adjacencyMap = new Map<PinId, PinId[]>()
  for (const [firstPinId, secondPinId] of edges) {
    adjacencyMap.set(firstPinId, [
      ...(adjacencyMap.get(firstPinId) ?? []),
      secondPinId,
    ])
    adjacencyMap.set(secondPinId, [
      ...(adjacencyMap.get(secondPinId) ?? []),
      firstPinId,
    ])
  }

  const connectedPinIds = new Set<PinId>([startPinId])
  const queue = [startPinId]
  for (let queueIndex = 0; queueIndex < queue.length; queueIndex++) {
    const pinId = queue[queueIndex]!
    for (const adjacentPinId of adjacencyMap.get(pinId) ?? []) {
      if (connectedPinIds.has(adjacentPinId)) continue
      connectedPinIds.add(adjacentPinId)
      queue.push(adjacentPinId)
    }
  }

  return connectedPinIds
}

const getManhattanDistance = ({
  firstPin,
  secondPin,
}: {
  firstPin: InputPin
  secondPin: InputPin
}) => Math.abs(firstPin.x - secondPin.x) + Math.abs(firstPin.y - secondPin.y)

const hasPinsOnSingleAxisOfChipEdges = (chip: InputChip) => {
  const leftEdge = chip.center.x - chip.width / 2
  const rightEdge = chip.center.x + chip.width / 2
  const topEdge = chip.center.y + chip.height / 2
  const bottomEdge = chip.center.y - chip.height / 2
  const allPinsOnVerticalEdges = chip.pins.every(
    (pin) =>
      Math.abs(pin.x - leftEdge) < CHIP_EDGE_TOLERANCE ||
      Math.abs(pin.x - rightEdge) < CHIP_EDGE_TOLERANCE,
  )
  const allPinsOnHorizontalEdges = chip.pins.every(
    (pin) =>
      Math.abs(pin.y - topEdge) < CHIP_EDGE_TOLERANCE ||
      Math.abs(pin.y - bottomEdge) < CHIP_EDGE_TOLERANCE,
  )

  return allPinsOnVerticalEdges || allPinsOnHorizontalEdges
}

const findReplacementEdge = ({
  connectedPinIds,
  pins,
  inputProblem,
  chipMap,
  pinIdMap,
  maxDistance,
}: {
  connectedPinIds: ReadonlySet<PinId>
  pins: PinWithChip[]
  inputProblem: InputProblem
  chipMap: Record<string, InputChip>
  pinIdMap: Map<PinId, PinWithChip>
  maxDistance: number
}): MspEdge | null => {
  let bestCandidate: ReplacementCandidate | null = null

  for (const firstPin of pins) {
    for (const secondPin of pins) {
      if (!connectedPinIds.has(firstPin.pinId)) continue
      if (connectedPinIds.has(secondPin.pinId)) continue
      if (firstPin.chipId === secondPin.chipId) continue

      const distance = getManhattanDistance({ firstPin, secondPin })
      if (distance > maxDistance) continue
      if (
        arePinsInDifferentSchematicSections(inputProblem, firstPin, secondPin)
      ) {
        continue
      }
      if (
        doesPairCrossRestrictedCenterLines({
          inputProblem,
          chipMap,
          pinIdMap,
          p1: firstPin,
          p2: secondPin,
        })
      ) {
        continue
      }

      const edge: MspEdge = [firstPin.pinId, secondPin.pinId]
      const candidate: ReplacementCandidate = {
        edge,
        distance,
        lowerPinId: firstPin.pinId,
        upperPinId: secondPin.pinId,
      }
      if (candidate.lowerPinId > candidate.upperPinId) {
        candidate.lowerPinId = secondPin.pinId
        candidate.upperPinId = firstPin.pinId
      }
      if (!bestCandidate || candidate.distance < bestCandidate.distance) {
        bestCandidate = candidate
        continue
      }
      if (
        candidate.distance === bestCandidate.distance &&
        (candidate.lowerPinId < bestCandidate.lowerPinId ||
          (candidate.lowerPinId === bestCandidate.lowerPinId &&
            candidate.upperPinId < bestCandidate.upperPinId))
      ) {
        bestCandidate = candidate
      }
    }
  }

  return bestCandidate?.edge ?? null
}

/** Reconnects avoidable same-component tree edges through nearby components. */
export const replaceIntraComponentMspEdges = ({
  edges,
  pins,
  inputProblem,
  chipMap,
  pinIdMap,
  maxDistance,
}: {
  edges: MspEdge[]
  pins: PinWithChip[]
  inputProblem: InputProblem
  chipMap: Record<string, InputChip>
  pinIdMap: Map<PinId, PinWithChip>
  maxDistance: number
}) => {
  const outputEdges = [...edges]

  for (let edgeIndex = 0; edgeIndex < outputEdges.length; edgeIndex++) {
    const [firstPinId, secondPinId] = outputEdges[edgeIndex]!
    const firstPin = pinIdMap.get(firstPinId)!
    const secondPin = pinIdMap.get(secondPinId)!
    if (firstPin.chipId !== secondPin.chipId) continue
    if (!hasPinsOnSingleAxisOfChipEdges(chipMap[firstPin.chipId]!)) continue

    const firstPinDegree = outputEdges.filter((edge) =>
      edge.includes(firstPinId),
    ).length
    const secondPinDegree = outputEdges.filter((edge) =>
      edge.includes(secondPinId),
    ).length
    const connectsLeafToHub =
      (firstPinDegree === 1 &&
        secondPinDegree >= MIN_HUB_DEGREE_WITH_LOCAL_EDGE) ||
      (secondPinDegree === 1 &&
        firstPinDegree >= MIN_HUB_DEGREE_WITH_LOCAL_EDGE)
    if (!connectsLeafToHub) continue

    const remainingEdges = outputEdges.filter(
      (_edge, candidateIndex) => candidateIndex !== edgeIndex,
    )
    const connectedPinIds = getConnectedPinIds({
      startPinId: firstPinId,
      edges: remainingEdges,
    })
    const replacementEdge = findReplacementEdge({
      connectedPinIds,
      pins,
      inputProblem,
      chipMap,
      pinIdMap,
      maxDistance,
    })
    if (!replacementEdge) continue
    outputEdges[edgeIndex] = replacementEdge
  }

  return outputEdges
}
