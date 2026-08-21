import type { Point } from "@tscircuit/math-utils"
import type { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import { boundsOverlap, getTextBoxBounds } from "lib/utils/textBoxBounds"
import type { AvailableNetOrientationObstacleIndex } from "./AvailableNetOrientationObstacleIndex"
import { EPS, LABEL_SEARCH_STEP, WICK_CLEARANCE } from "./constants"
import { rangesOverlap, rectsOverlap } from "./geometry"
import type { Bounds, CandidateLabel, CandidateStatus } from "./types"

export function getNextBoundaryCandidateDistance(params: {
  candidate: CandidateLabel
  candidateStatus: CandidateStatus
  currentDistance: number
  direction: Point
  inputProblem: InputProblem
  netLabelPlacements: NetLabelPlacement[]
  labelIndex: number
  crowdedLabelIndices: Set<number>
  queuedLabelIndices: number[]
  blockedStandaloneLabelIndex: number | null
  chipObstacleSpatialIndex: ChipObstacleSpatialIndex
  obstacleIndex: AvailableNetOrientationObstacleIndex
}): number | null {
  const candidateBounds = getRectBounds(
    params.candidate.center,
    params.candidate.width,
    params.candidate.height,
  )
  const blockingBounds = getBlockingBounds({ ...params, candidateBounds })
  if (blockingBounds.length === 0) return null

  let distanceToClear = 0
  for (const bounds of blockingBounds) {
    distanceToClear = Math.max(
      distanceToClear,
      getDistanceToClearBounds({
        candidateBounds,
        blockingBounds: bounds,
        direction: params.direction,
      }),
    )
  }
  if (distanceToClear <= EPS) return null

  const boundaryDistance = params.currentDistance + distanceToClear
  const boundaryStep = Math.ceil((boundaryDistance - EPS) / LABEL_SEARCH_STEP)
  return boundaryStep * LABEL_SEARCH_STEP
}

function getBlockingBounds(params: {
  candidateBounds: Bounds
  candidateStatus: CandidateStatus
  inputProblem: InputProblem
  netLabelPlacements: NetLabelPlacement[]
  labelIndex: number
  crowdedLabelIndices: Set<number>
  queuedLabelIndices: number[]
  blockedStandaloneLabelIndex: number | null
  chipObstacleSpatialIndex: ChipObstacleSpatialIndex
  obstacleIndex: AvailableNetOrientationObstacleIndex
}): Bounds[] {
  if (params.candidateStatus === "chip-collision") {
    const searchBounds = getPaddedBounds(
      params.candidateBounds,
      WICK_CLEARANCE + EPS,
    )
    return params.chipObstacleSpatialIndex
      .getChipsInBounds(searchBounds)
      .map((chip) => chip.bounds)
      .filter((bounds) =>
        doesCandidateBoundsCollideWithChip(params.candidateBounds, bounds),
      )
  }

  if (params.candidateStatus === "text-collision") {
    return (params.inputProblem.textBoxes ?? [])
      .map((textBox) => getTextBoxBounds(textBox))
      .filter((bounds) => boundsOverlap(bounds, params.candidateBounds))
  }

  if (params.candidateStatus !== "netlabel-collision") return []

  const searchBounds = getPaddedBounds(
    params.candidateBounds,
    LABEL_SEARCH_STEP,
  )
  const blockingBounds: Bounds[] = []
  for (const otherLabelIndex of params.obstacleIndex.getLabelIndicesInBounds(
    searchBounds,
  )) {
    if (otherLabelIndex === params.labelIndex) continue
    if (
      shouldIgnorePendingCrowdedLabel({
        labelIndex: params.labelIndex,
        otherLabelIndex,
        crowdedLabelIndices: params.crowdedLabelIndices,
        queuedLabelIndices: params.queuedLabelIndices,
      })
    ) {
      continue
    }
    const otherLabel = params.netLabelPlacements[otherLabelIndex]!
    const otherBounds = getRectBounds(
      otherLabel.center,
      otherLabel.width,
      otherLabel.height,
    )
    if (
      otherLabelIndex === params.blockedStandaloneLabelIndex &&
      (otherLabel.orientation === "y+" || otherLabel.orientation === "y-")
    ) {
      otherBounds.minX -= LABEL_SEARCH_STEP
      otherBounds.maxX += LABEL_SEARCH_STEP
    }
    if (rectsOverlap(params.candidateBounds, otherBounds)) {
      blockingBounds.push(otherBounds)
    }
  }
  return blockingBounds
}

function doesCandidateBoundsCollideWithChip(
  candidateBounds: Bounds,
  chipBounds: Bounds,
) {
  if (rectsOverlap(candidateBounds, chipBounds)) return true

  const touchesVerticalSide =
    Math.abs(candidateBounds.minX - chipBounds.maxX) <= WICK_CLEARANCE + EPS ||
    Math.abs(candidateBounds.maxX - chipBounds.minX) <= WICK_CLEARANCE + EPS
  if (
    touchesVerticalSide &&
    rangesOverlap(
      candidateBounds.minY,
      candidateBounds.maxY,
      chipBounds.minY,
      chipBounds.maxY,
    )
  ) {
    return true
  }

  const touchesHorizontalSide =
    Math.abs(candidateBounds.minY - chipBounds.maxY) <= WICK_CLEARANCE + EPS ||
    Math.abs(candidateBounds.maxY - chipBounds.minY) <= WICK_CLEARANCE + EPS
  return (
    touchesHorizontalSide &&
    rangesOverlap(
      candidateBounds.minX,
      candidateBounds.maxX,
      chipBounds.minX,
      chipBounds.maxX,
    )
  )
}

function shouldIgnorePendingCrowdedLabel(params: {
  labelIndex: number
  otherLabelIndex: number
  crowdedLabelIndices: Set<number>
  queuedLabelIndices: number[]
}) {
  return (
    params.crowdedLabelIndices.has(params.labelIndex) &&
    params.crowdedLabelIndices.has(params.otherLabelIndex) &&
    params.queuedLabelIndices.includes(params.otherLabelIndex)
  )
}

function getDistanceToClearBounds(params: {
  candidateBounds: Bounds
  blockingBounds: Bounds
  direction: Point
}) {
  if (params.direction.x > 0) {
    return params.blockingBounds.maxX - params.candidateBounds.minX
  }
  if (params.direction.x < 0) {
    return params.candidateBounds.maxX - params.blockingBounds.minX
  }
  if (params.direction.y > 0) {
    return params.blockingBounds.maxY - params.candidateBounds.minY
  }
  return params.candidateBounds.maxY - params.blockingBounds.minY
}

function getPaddedBounds(bounds: Bounds, padding: number): Bounds {
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
  }
}
