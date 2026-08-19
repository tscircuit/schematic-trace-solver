import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { moveAttachedLabelsToReroutedTrace } from "lib/solvers/Example28Solver/labelMovement"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import {
  getVisibleTraceLength,
  getVisibleTraceSegmentCount,
  isHorizontal,
  nearlyEqual,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputPin, InputProblem, SectionId } from "lib/types/InputProblem"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import {
  pathEntersAnyNetLabel,
  pathIntersectsAnyNetLabel,
} from "./pathIntersectsAnyNetLabel"
import { trimSameNetOverlappingTraceTails } from "./trimSameNetOverlappingTraceTails"

interface AlignSameNetJunctionsInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

interface HorizontalSegment {
  start: Point
  end: Point
}

// Only near-level load pins should be combined onto one horizontal rail.
const MAX_ALIGNED_LOAD_PIN_OFFSET = 0.2
// Limit label-boundary alignment to small corrections that cannot create spikes.
const MAX_SAME_NET_LABEL_BOUNDARY_RAIL_OFFSET = 0.2

const getSharedPin = ({
  donorTrace,
  branchTrace,
}: {
  donorTrace: SolvedTracePath
  branchTrace: SolvedTracePath
}): (InputPin & { chipId: string }) | null => {
  const branchPinIds = new Set(branchTrace.pins.map((pin) => pin.pinId))
  return donorTrace.pins.find((pin) => branchPinIds.has(pin.pinId)) ?? null
}

const getOtherPin = ({
  trace,
  sharedPin,
}: {
  trace: SolvedTracePath
  sharedPin: InputPin
}) => trace.pins.find((pin) => pin.pinId !== sharedPin.pinId) ?? null

const getLongestHorizontalSegment = (
  trace: SolvedTracePath,
): HorizontalSegment | null => {
  let longest: HorizontalSegment | null = null
  for (let index = 0; index < trace.tracePath.length - 1; index++) {
    const start = trace.tracePath[index]!
    const end = trace.tracePath[index + 1]!
    if (!isHorizontal(start, end)) continue
    if (
      !longest ||
      Math.abs(end.x - start.x) > Math.abs(longest.end.x - longest.start.x)
    ) {
      longest = { start, end }
    }
  }
  return longest
}

const getJunctionPoint = ({
  segment,
  sharedPin,
}: {
  segment: HorizontalSegment
  sharedPin: Point
}) => {
  const startDistance = Math.abs(segment.start.x - sharedPin.x)
  const endDistance = Math.abs(segment.end.x - sharedPin.x)
  if (startDistance <= endDistance) return segment.start
  return segment.end
}

const railIsOnFacingSide = ({
  railY,
  pin,
}: {
  railY: number
  pin: InputPin
}) => {
  if (pin._facingDirection === "y+") return railY > pin.y
  return false
}

const getAttachedLabelIndexes = (
  trace: SolvedTracePath,
  netLabelPlacements: NetLabelPlacement[],
) =>
  netLabelPlacements.flatMap((label, index) => {
    const labelOwnsTrace =
      label.mspConnectionPairIds.includes(trace.mspPairId) ||
      (label.mspConnectionPairIds.length === 0 &&
        label.globalConnNetId === trace.globalConnNetId)
    return labelOwnsTrace &&
      tracePathContainsPoint(trace.tracePath, label.anchorPoint)
      ? [index]
      : []
  })

const moveAttachedLabels = ({
  trace,
  reroutedTracePath,
  netLabelPlacements,
  attachedLabelIndexes,
}: {
  trace: SolvedTracePath
  reroutedTracePath: Point[]
  netLabelPlacements: NetLabelPlacement[]
  attachedLabelIndexes: number[]
}) => {
  const attachedLabels = attachedLabelIndexes.map(
    (index) => netLabelPlacements[index]!,
  )
  const movedAttachedLabels = moveAttachedLabelsToReroutedTrace({
    trace,
    originalTracePath: trace.tracePath,
    reroutedTracePath,
    netLabelPlacements: attachedLabels,
  })
  const movedLabelByIndex = new Map(
    attachedLabelIndexes.map((labelIndex, index) => [
      labelIndex,
      movedAttachedLabels[index]!,
    ]),
  )
  return netLabelPlacements.map(
    (label, index) => movedLabelByIndex.get(index) ?? label,
  )
}

const getAlignedBranchPath = ({
  donorTrace,
  branchTrace,
}: {
  donorTrace: SolvedTracePath
  branchTrace: SolvedTracePath
}): Point[] | null => {
  const sharedPin = getSharedPin({ donorTrace, branchTrace })
  if (!sharedPin) return null
  const donorOtherPin = getOtherPin({ trace: donorTrace, sharedPin })
  if (!donorOtherPin) return null
  const otherPin = getOtherPin({ trace: branchTrace, sharedPin })
  if (!otherPin) return null
  if (Math.abs(sharedPin.y - otherPin.y) > MAX_ALIGNED_LOAD_PIN_OFFSET) {
    return null
  }

  const donorRail = getLongestHorizontalSegment(donorTrace)
  if (!donorRail) return null
  const branchRail = getLongestHorizontalSegment(branchTrace)
  if (branchRail && nearlyEqual(branchRail.start.y, donorRail.start.y)) {
    return null
  }
  if (!railIsOnFacingSide({ railY: donorRail.start.y, pin: otherPin })) {
    return null
  }

  const junction = getJunctionPoint({ segment: donorRail, sharedPin })
  const extendsDonorRail =
    (donorOtherPin.x < junction.x && otherPin.x > junction.x) ||
    (donorOtherPin.x > junction.x && otherPin.x < junction.x)
  if (!extendsDonorRail) return null

  const sharedToOther = simplifyPath([
    { x: sharedPin.x, y: sharedPin.y },
    { x: junction.x, y: sharedPin.y },
    { x: junction.x, y: junction.y },
    { x: otherPin.x, y: junction.y },
    { x: otherPin.x, y: otherPin.y },
  ])

  if (branchTrace.pins[0].pinId === sharedPin.pinId) return sharedToOther
  return [...sharedToOther].reverse()
}

const candidateIsClear = ({
  candidateTrace,
  originalTrace,
  traces,
  inputProblem,
  candidateNetLabelPlacements,
  attachedLabelIndexes,
}: {
  candidateTrace: SolvedTracePath
  originalTrace: SolvedTracePath
  traces: SolvedTracePath[]
  inputProblem: InputProblem
  candidateNetLabelPlacements: NetLabelPlacement[]
  attachedLabelIndexes: number[]
}) => {
  const obstacles = getObstacleRects(inputProblem)
  if (isPathCollidingWithObstacles(candidateTrace.tracePath, obstacles)) {
    return false
  }

  const otherNetTraces = traces.filter(
    (trace) => trace.globalConnNetId !== candidateTrace.globalConnNetId,
  )
  if (doesPathCoincideWithTraces(candidateTrace.tracePath, otherNetTraces)) {
    return false
  }

  if (
    !attachedLabelIndexes.every((index) =>
      tracePathContainsPoint(
        candidateTrace.tracePath,
        candidateNetLabelPlacements[index]!.anchorPoint,
      ),
    )
  ) {
    return false
  }

  const otherNetLabelPlacements = candidateNetLabelPlacements.filter(
    (label) => label.globalConnNetId !== candidateTrace.globalConnNetId,
  )
  if (
    pathIntersectsAnyNetLabel({
      path: candidateTrace.tracePath,
      netLabelPlacements: otherNetLabelPlacements,
    })
  ) {
    return false
  }

  const sameNetLabelPlacements = candidateNetLabelPlacements.filter(
    (label) => label.globalConnNetId === candidateTrace.globalConnNetId,
  )
  // A same-net rail may follow its label edge, but never enter the label body.
  if (
    !pathIntersectsAnyNetLabel({
      path: candidateTrace.tracePath,
      netLabelPlacements: sameNetLabelPlacements,
    })
  ) {
    return true
  }
  if (
    pathEntersAnyNetLabel({
      path: candidateTrace.tracePath,
      netLabelPlacements: sameNetLabelPlacements,
    })
  ) {
    return false
  }

  const originalRail = getLongestHorizontalSegment(originalTrace)
  const candidateRail = getLongestHorizontalSegment(candidateTrace)
  if (!originalRail || !candidateRail) return false
  return (
    Math.abs(originalRail.start.y - candidateRail.start.y) <=
    MAX_SAME_NET_LABEL_BOUNDARY_RAIL_OFFSET
  )
}

export const alignSameNetJunctions = ({
  inputProblem,
  traces,
  netLabelPlacements,
}: AlignSameNetJunctionsInput) => {
  let outputTraces = [...traces]
  let outputNetLabelPlacements = [...netLabelPlacements]
  const alignedBranchTraceIds = new Set<string>()
  const alignedSectionIds = new Set<SectionId>()
  let alignedJunctionCount = 0

  // Reuse each aligned branch as the rail for the next load in the chain. An
  // aligned branch may already have had its donor turn, so queue it again when
  // its geometry changes.
  const donorTraceIds = traces.map((trace) => trace.mspPairId)
  const pendingDonorTraceIds = new Set(donorTraceIds)
  for (let donorIndex = 0; donorIndex < donorTraceIds.length; donorIndex++) {
    const donorTraceId = donorTraceIds[donorIndex]!
    pendingDonorTraceIds.delete(donorTraceId)
    const donorTrace = outputTraces.find(
      (trace) => trace.mspPairId === donorTraceId,
    )!
    for (const branchTrace of outputTraces) {
      if (alignedBranchTraceIds.has(branchTrace.mspPairId)) continue
      if (donorTrace.mspPairId === branchTrace.mspPairId) continue
      if (donorTrace.globalConnNetId !== branchTrace.globalConnNetId) continue

      const candidatePath = getAlignedBranchPath({ donorTrace, branchTrace })
      if (!candidatePath) continue
      const candidateTrace = { ...branchTrace, tracePath: candidatePath }
      const originalPair = [donorTrace, branchTrace]
      const candidatePair = [donorTrace, candidateTrace]
      const removesVisibleSegment =
        getVisibleTraceSegmentCount(candidatePair) <
        getVisibleTraceSegmentCount(originalPair)
      const shortensVisibleTrace =
        getVisibleTraceLength(candidatePair) <
          getVisibleTraceLength(originalPair) &&
        !nearlyEqual(
          getVisibleTraceLength(candidatePair),
          getVisibleTraceLength(originalPair),
        )
      if (!removesVisibleSegment && !shortensVisibleTrace) {
        continue
      }
      const attachedLabelIndexes = getAttachedLabelIndexes(
        branchTrace,
        outputNetLabelPlacements,
      )
      const candidateNetLabelPlacements = moveAttachedLabels({
        trace: branchTrace,
        reroutedTracePath: candidatePath,
        netLabelPlacements: outputNetLabelPlacements,
        attachedLabelIndexes,
      })
      if (
        !candidateIsClear({
          candidateTrace,
          originalTrace: branchTrace,
          traces: outputTraces,
          inputProblem,
          candidateNetLabelPlacements,
          attachedLabelIndexes,
        })
      ) {
        continue
      }

      outputTraces = outputTraces.map((trace) => {
        if (trace.mspPairId === branchTrace.mspPairId) return candidateTrace
        return trace
      })
      outputNetLabelPlacements = candidateNetLabelPlacements
      alignedBranchTraceIds.add(branchTrace.mspPairId)
      const sharedPin = getSharedPin({ donorTrace, branchTrace })!
      const sharedPinChip = inputProblem.chips.find(
        (chip) => chip.chipId === sharedPin.chipId,
      )
      if (sharedPinChip?.sectionId) {
        alignedSectionIds.add(sharedPinChip.sectionId)
      }
      alignedJunctionCount++
      if (!pendingDonorTraceIds.has(branchTrace.mspPairId)) {
        donorTraceIds.push(branchTrace.mspPairId)
        pendingDonorTraceIds.add(branchTrace.mspPairId)
      }
    }
  }

  const trimmedOverlaps = trimSameNetOverlappingTraceTails({
    traces: outputTraces,
    inputProblem,
    alignedSectionIds,
    alignedBranchTraceIds,
  })

  return {
    traces: trimmedOverlaps.traces,
    netLabelPlacements: outputNetLabelPlacements,
    alignedJunctionCount,
    trimmedSameNetOverlapCount: trimmedOverlaps.trimmedSameNetOverlapCount,
    collapsedSameNetHairpinCount:
      trimmedOverlaps.collapsedSameNetHairpinCount ?? 0,
  }
}
