import type { Point } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import { moveAttachedLabelsToReroutedTrace } from "lib/solvers/Example28Solver/labelMovement"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { getTraceConnectedPinComponents } from "lib/solvers/SchematicTraceLinesSolver/getTraceConnectedPinComponents"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import {
  getVisibleTraceLength,
  getVisibleTraceSegmentCount,
  isHorizontal,
  isVertical,
  nearlyEqual,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputPin, InputProblem } from "lib/types/InputProblem"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import {
  pathEntersAnyNetLabel,
  pathIntersectsAnyNetLabel,
} from "./pathIntersectsAnyNetLabel"

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
// A shared vertical pin can anchor an existing rail when the rail is only a
// symbol-stem correction away from the pin itself.
const MAX_SHARED_PIN_RAIL_OFFSET = 0.05
const MIN_RETURN_STEM_LENGTH = 0.05
const MIN_ESTABLISHED_LEVEL_RAIL_TRACE_COUNT = 2

export const getSharedPin = ({
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
  if (pin._facingDirection === "y-") return railY < pin.y
  return false
}

const railIsOnSharedPinFacingSide = ({
  railY,
  pin,
}: {
  railY: number
  pin: InputPin
}) => {
  if (pin._facingDirection === "y+") return railY > pin.y
  if (pin._facingDirection === "y-") return railY < pin.y
  return false
}

const getHorizontalPinApproachPoint = ({
  branchTrace,
  sharedPin,
  otherPin,
}: {
  branchTrace: SolvedTracePath
  sharedPin: InputPin
  otherPin: InputPin
}): Point | null => {
  if (
    otherPin._facingDirection !== "x-" &&
    otherPin._facingDirection !== "x+"
  ) {
    return null
  }

  const sharedToOtherPath =
    branchTrace.pins[0].pinId === sharedPin.pinId
      ? branchTrace.tracePath
      : [...branchTrace.tracePath].reverse()
  const approachPoint = sharedToOtherPath.at(-2)
  if (!approachPoint || !nearlyEqual(approachPoint.y, otherPin.y)) return null

  const approachesFromFacingSide =
    otherPin._facingDirection === "x-"
      ? approachPoint.x < otherPin.x
      : approachPoint.x > otherPin.x
  return approachesFromFacingSide ? approachPoint : null
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
  const railFacesOtherPin = railIsOnFacingSide({
    railY: donorRail.start.y,
    pin: otherPin,
  })
  const railFacesSharedPin =
    railIsOnSharedPinFacingSide({
      railY: donorRail.start.y,
      pin: sharedPin,
    }) &&
    Math.abs(donorRail.start.y - sharedPin.y) <= MAX_SHARED_PIN_RAIL_OFFSET
  if (!railFacesOtherPin && !railFacesSharedPin) {
    return null
  }

  const junction = getJunctionPoint({ segment: donorRail, sharedPin })
  const extendsDonorRail =
    (donorOtherPin.x < junction.x && otherPin.x > junction.x) ||
    (donorOtherPin.x > junction.x && otherPin.x < junction.x)
  if (!extendsDonorRail) return null

  let sharedToOther: Point[]
  if (!railFacesOtherPin && railFacesSharedPin) {
    const approachPoint = getHorizontalPinApproachPoint({
      branchTrace,
      sharedPin,
      otherPin,
    })
    if (!approachPoint) return null
    sharedToOther = simplifyPath([
      { x: sharedPin.x, y: sharedPin.y },
      { x: junction.x, y: sharedPin.y },
      { x: junction.x, y: junction.y },
      { x: approachPoint.x, y: junction.y },
      { x: approachPoint.x, y: otherPin.y },
      { x: otherPin.x, y: otherPin.y },
    ])
  } else {
    sharedToOther = simplifyPath([
      { x: sharedPin.x, y: sharedPin.y },
      { x: junction.x, y: sharedPin.y },
      { x: junction.x, y: junction.y },
      { x: otherPin.x, y: junction.y },
      { x: otherPin.x, y: otherPin.y },
    ])
  }

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

  // Moving a junction must not introduce an extra crossing on another net,
  // including single-segment traces and intersections at a bend.
  for (const otherTrace of otherNetTraces) {
    const countIntersections = (path: Point[]) => {
      const intersections = new Set<string>()
      for (let i = 1; i < path.length; i++) {
        for (let j = 1; j < otherTrace.tracePath.length; j++) {
          const point = getSegmentIntersection(
            path[i - 1]!,
            path[i]!,
            otherTrace.tracePath[j - 1]!,
            otherTrace.tracePath[j]!,
          )
          if (point)
            intersections.add(`${point.x.toFixed(6)},${point.y.toFixed(6)}`)
        }
      }
      return intersections.size
    }
    if (
      countIntersections(candidateTrace.tracePath) >
      countIntersections(originalTrace.tracePath)
    ) {
      return false
    }
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

const establishedLevelRailHasBlockedMember = ({
  donorTrace,
  branchTrace,
  traces,
  inputProblem,
}: {
  donorTrace: SolvedTracePath
  branchTrace: SolvedTracePath
  traces: SolvedTracePath[]
  inputProblem: InputProblem
}) => {
  const donorRail = getLongestHorizontalSegment(donorTrace)
  const branchRail = getLongestHorizontalSegment(branchTrace)
  if (!donorRail || !branchRail) return false

  const sameLevelTraces = traces.filter((trace) => {
    if (trace.globalConnNetId !== branchTrace.globalConnNetId) return false
    const rail = getLongestHorizontalSegment(trace)
    return rail !== null && nearlyEqual(rail.start.y, branchRail.start.y)
  })
  const pinIds = [...new Set(sameLevelTraces.flatMap((trace) => trace.pinIds))]
  const chain = getTraceConnectedPinComponents({
    pinIds,
    traces: sameLevelTraces,
  }).find((component) => component.traces.includes(branchTrace))?.traces
  if (!chain) return false
  if (chain.length < MIN_ESTABLISHED_LEVEL_RAIL_TRACE_COUNT) return false

  const obstacles = getObstacleRects(inputProblem)
  return chain.some((trace) => {
    const [firstPin, secondPin] = trace.pins
    if (!firstPin || !secondPin || !nearlyEqual(firstPin.y, secondPin.y)) {
      return false
    }
    const candidatePath = simplifyPath([
      { x: firstPin.x, y: firstPin.y },
      { x: firstPin.x, y: donorRail.start.y },
      { x: secondPin.x, y: donorRail.start.y },
      { x: secondPin.x, y: secondPin.y },
    ])
    const endpointChipIds = new Set(trace.pins.map((pin) => pin.chipId))
    const unrelatedObstacles = obstacles.filter(
      (obstacle) =>
        obstacle.kind !== "chip" || !endpointChipIds.has(obstacle.chipId),
    )
    return isPathCollidingWithObstacles(candidatePath, unrelatedObstacles)
  })
}

/** Extend the outer load's stem instead of adding a return trunk between loads. */
const getAlignedReturnBranchPath = ({
  donorTrace,
  branchTrace,
  returnStemScale = 1,
}: {
  donorTrace: SolvedTracePath
  branchTrace: SolvedTracePath
  returnStemScale?: number
}): Point[] | null => {
  const sharedPin = getSharedPin({ donorTrace, branchTrace })
  if (!sharedPin) return null
  const railPin = getOtherPin({ trace: donorTrace, sharedPin })
  const returnPin = getOtherPin({ trace: branchTrace, sharedPin })
  if (!railPin || !returnPin) return null
  const facing = sharedPin._facingDirection
  if (facing !== "y+" && facing !== "y-") return null
  if (
    railPin._facingDirection !== facing ||
    returnPin._facingDirection !== facing
  )
    return null
  if (!nearlyEqual(sharedPin.y, railPin.y)) return null

  const donorPath = simplifyPath(donorTrace.tracePath)
  if (donorPath.length !== 4) return null
  const rail = getLongestHorizontalSegment(donorTrace)
  if (!rail || !railIsOnFacingSide({ railY: rail.start.y, pin: sharedPin }))
    return null
  if (
    !isVertical(donorPath[0]!, donorPath[1]!) ||
    !isVertical(donorPath[2]!, donorPath[3]!)
  )
    return null

  const sharedFirst = branchTrace.pins[0].pinId === sharedPin.pinId
  const path = simplifyPath(
    sharedFirst ? branchTrace.tracePath : [...branchTrace.tracePath].reverse(),
  )
  // A return branch leaves the shared stem, detours beside the loads, and
  // approaches the remote parallel pin from its facing side.
  if (path.length !== 6) return null
  if (
    !isVertical(path[0]!, path[1]!) ||
    !isHorizontal(path[1]!, path[2]!) ||
    !isVertical(path[2]!, path[3]!) ||
    !isHorizontal(path[3]!, path[4]!) ||
    !isVertical(path[4]!, path[5]!)
  )
    return null
  if (
    !railIsOnFacingSide({ railY: path[1]!.y, pin: sharedPin }) ||
    !railIsOnFacingSide({ railY: path[4]!.y, pin: returnPin })
  )
    return null
  const direction = facing === "y+" ? 1 : -1
  if (direction * (returnPin.y - rail.start.y) <= 0) return null

  const minX = Math.min(sharedPin.x, railPin.x)
  const maxX = Math.max(sharedPin.x, railPin.x)
  if (path[2]!.x < minX || path[2]!.x > maxX) return null
  if (
    nearlyEqual(path[2]!.x, railPin.x) &&
    nearlyEqual(path[1]!.y, rail.start.y)
  )
    return null

  const returnRailY = returnPin.y + (path[4]!.y - returnPin.y) * returnStemScale
  if (Math.abs(returnRailY - returnPin.y) < MIN_RETURN_STEM_LENGTH - 1e-6)
    return null
  const candidate = simplifyPath([
    { x: sharedPin.x, y: sharedPin.y },
    { x: sharedPin.x, y: rail.start.y },
    { x: railPin.x, y: rail.start.y },
    { x: railPin.x, y: returnRailY },
    { x: returnPin.x, y: returnRailY },
    { x: returnPin.x, y: returnPin.y },
  ])
  return sharedFirst ? candidate : candidate.reverse()
}

export const alignSameNetJunctions = ({
  inputProblem,
  traces,
  netLabelPlacements,
}: AlignSameNetJunctionsInput) => {
  let outputTraces = [...traces]
  let outputNetLabelPlacements = [...netLabelPlacements]
  let alignedJunctionCount = 0

  // First level the load rails, then attach return branches to those final
  // rails. Doing this in one pass could attach a branch to a rail that moves later.
  for (const alignReturnBranches of [false, true]) {
    const alignedBranchTraceIds = new Set<string>()
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

        // Prefer the existing return stem. If extending the outer column
        // meets another net, try shorter escapes without moving any pins.
        const candidatePaths = alignReturnBranches
          ? [1, 0.5, 0.25].map((returnStemScale) =>
              getAlignedReturnBranchPath({
                donorTrace,
                branchTrace,
                returnStemScale,
              }),
            )
          : [getAlignedBranchPath({ donorTrace, branchTrace })]
        for (const candidatePath of candidatePaths) {
          if (!candidatePath) continue
          const candidateTrace = { ...branchTrace, tracePath: candidatePath }
          // Keep an already-level chain intact when one load cannot follow the
          // proposed alignment because of an unrelated obstacle.
          if (
            !alignReturnBranches &&
            establishedLevelRailHasBlockedMember({
              donorTrace,
              branchTrace,
              traces: outputTraces,
              inputProblem,
            })
          ) {
            continue
          }
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
          alignedJunctionCount++
          if (!pendingDonorTraceIds.has(branchTrace.mspPairId)) {
            donorTraceIds.push(branchTrace.mspPairId)
            pendingDonorTraceIds.add(branchTrace.mspPairId)
          }
          break
        }
      }
    }
  }

  return {
    traces: outputTraces,
    netLabelPlacements: outputNetLabelPlacements,
    alignedJunctionCount,
  }
}
