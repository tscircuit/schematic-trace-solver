import type { Point } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { getMovedAnchorPointForReroute } from "lib/solvers/Example28Solver/getMovedAnchorPointForReroute"
import {
  findSegmentContainingPoint,
  getSegments,
  projectPointToSegment,
} from "lib/solvers/Example28Solver/geometry"
import { moveAttachedLabelsToReroutedTrace } from "lib/solvers/Example28Solver/labelMovement"
import {
  rectsOverlap,
  tracePathContainsPoint,
} from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import {
  getVisibleTraceLength,
  getVisibleTraceSegmentCount,
  isHorizontal,
  isVertical,
  nearlyEqual,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputPin, InputProblem } from "lib/types/InputProblem"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import {
  pathEntersAnyNetLabel,
  pathIntersectsAnyNetLabel,
} from "./pathIntersectsAnyNetLabel"
import {
  findNearestSharedPinExitRail,
  getPinFacingAxis,
  isCoordinateOnPinFacingSide,
} from "./findNearestSharedPinExitRail"

interface AlignSameNetJunctionsInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  netLabelConnectorTraceIds: ReadonlySet<MspConnectionPairId>
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
// Nearby rails that leave the same junction can be combined even when the
// shared rail is slightly longer. The visible result has one continuous run
// instead of two parallel runs joined by a jog.
const MAX_SHARED_ENDPOINT_RAIL_OFFSET = 0.8
const MIN_RETURN_STEM_LENGTH = 0.05

const getSegmentAxis = (start: Point, end: Point) => {
  if (isHorizontal(start, end)) return "x" as const
  if (isVertical(start, end)) return "y" as const
  return null
}

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
  for (const [index, label] of attachedLabels.entries()) {
    if (label.orientation !== "y+" && label.orientation !== "y-") continue
    const originalSegment = findSegmentContainingPoint(
      trace.tracePath,
      label.anchorPoint,
    )
    if (originalSegment?.orientation !== "horizontal") continue
    const sameRowSegment = getSegments(reroutedTracePath).find(
      (segment) =>
        segment.orientation === "horizontal" &&
        nearlyEqual(segment.start.y, label.anchorPoint.y),
    )
    if (!sameRowSegment) continue

    const anchorPoint = projectPointToSegment(
      label.anchorPoint,
      sameRowSegment.start,
      sameRowSegment.end,
    )
    movedAttachedLabels[index] = {
      ...label,
      anchorPoint,
      center: {
        x: label.center.x + anchorPoint.x - label.anchorPoint.x,
        y: label.center.y + anchorPoint.y - label.anchorPoint.y,
      },
    }
  }
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

/**
 * Reuse the row of an adjacent same-side pin for a branch leaving their
 * shared outer stem. This removes the extra parallel jog produced when the
 * branch initially routes beyond both pin rows before approaching a
 * perpendicular target pin. The topology is detected from pin-facing axes
 * and shared segments; the number and ordering of intermediate turns do not
 * define eligibility.
 */
const getAlignedParallelPinExitPath = ({
  donorTrace,
  branchTrace,
}: {
  donorTrace: SolvedTracePath
  branchTrace: SolvedTracePath
}): Point[] | null => {
  const sharedPin = getSharedPin({ donorTrace, branchTrace })
  if (!sharedPin) return null
  const adjacentPin = getOtherPin({ trace: donorTrace, sharedPin })
  const targetPin = getOtherPin({ trace: branchTrace, sharedPin })
  if (!adjacentPin || !targetPin) return null

  const facing = sharedPin._facingDirection
  const departureAxis = getPinFacingAxis(sharedPin)
  if (!facing || !departureAxis) return null
  const stemAxis = departureAxis === "x" ? "y" : "x"
  if (
    adjacentPin.chipId !== sharedPin.chipId ||
    adjacentPin._facingDirection !== facing ||
    !nearlyEqual(adjacentPin[departureAxis], sharedPin[departureAxis]) ||
    getPinFacingAxis(targetPin) !== stemAxis
  ) {
    return null
  }
  const adjacentPinOffset = Math.abs(
    adjacentPin[stemAxis] - sharedPin[stemAxis],
  )
  if (
    adjacentPinOffset > MAX_ALIGNED_LOAD_PIN_OFFSET &&
    !nearlyEqual(adjacentPinOffset, MAX_ALIGNED_LOAD_PIN_OFFSET)
  ) {
    return null
  }

  const branchStartsAtSharedPin = branchTrace.pins[0].pinId === sharedPin.pinId
  let sharedToTargetPath = simplifyPath(branchTrace.tracePath)
  if (!branchStartsAtSharedPin) sharedToTargetPath.reverse()
  if (sharedToTargetPath.length < 2) return null
  const branchDepartureSegment: [Point, Point] = [
    sharedToTargetPath[0]!,
    sharedToTargetPath[1]!,
  ]
  const sharedExitRail = findNearestSharedPinExitRail({
    donorPath: donorTrace.tracePath,
    branchDepartureSegment,
    sharedPin,
    adjacentPin,
  })
  if (!sharedExitRail) return null

  const alignedRailCoordinate = adjacentPin[stemAxis]
  if (
    !isCoordinateOnPinFacingSide({
      coordinate: alignedRailCoordinate,
      axis: stemAxis,
      pin: targetPin,
    })
  ) {
    return null
  }
  const alignedStemExit = {
    ...sharedExitRail.sharedPinExit,
    [stemAxis]: alignedRailCoordinate,
  }
  const targetApproach = {
    x: targetPin.x,
    y: targetPin.y,
    [stemAxis]: alignedRailCoordinate,
  }
  const candidate = simplifyPath([
    { x: sharedPin.x, y: sharedPin.y },
    sharedExitRail.sharedPinExit,
    alignedStemExit,
    targetApproach,
    { x: targetPin.x, y: targetPin.y },
  ])
  return branchStartsAtSharedPin ? candidate : candidate.reverse()
}

/**
 * Move the first movable rail of a branch onto the first rail of another
 * trace leaving the same endpoint. The two perpendicular rail intervals must
 * touch after the move; the caller then verifies that the combined visible
 * trace loses a segment and that the reroute is clear.
 */
const getAlignedSharedEndpointRailPath = ({
  donorTrace,
  branchTrace,
  netLabelConnectorTraceIds,
}: {
  donorTrace: SolvedTracePath
  branchTrace: SolvedTracePath
  netLabelConnectorTraceIds: ReadonlySet<MspConnectionPairId>
}): Point[] | null => {
  if (
    netLabelConnectorTraceIds.has(donorTrace.mspPairId) ||
    netLabelConnectorTraceIds.has(branchTrace.mspPairId)
  ) {
    return null
  }

  const sharedPin = getSharedPin({ donorTrace, branchTrace })
  if (!sharedPin) return null

  const pathFromShared = (trace: SolvedTracePath) => {
    const path = simplifyPath(trace.tracePath)
    return trace.pins[0]!.pinId === sharedPin.pinId ? path : [...path].reverse()
  }
  const donorPath = pathFromShared(donorTrace)
  const branchPath = pathFromShared(branchTrace)
  // The branch rail must be internal so moving it cannot move either pin.
  if (donorPath.length < 3 || branchPath.length < 4) return null

  const donorDepartureAxis = getSegmentAxis(donorPath[0]!, donorPath[1]!)
  const branchDepartureAxis = getSegmentAxis(branchPath[0]!, branchPath[1]!)
  if (!donorDepartureAxis || donorDepartureAxis !== branchDepartureAxis) {
    return null
  }
  const donorDeparture =
    donorPath[1]![donorDepartureAxis] - donorPath[0]![donorDepartureAxis]
  const branchDeparture =
    branchPath[1]![branchDepartureAxis] - branchPath[0]![branchDepartureAxis]
  if (Math.sign(donorDeparture) !== Math.sign(branchDeparture)) return null

  const donorRailAxis = getSegmentAxis(donorPath[1]!, donorPath[2]!)
  const branchRailAxis = getSegmentAxis(branchPath[1]!, branchPath[2]!)
  if (
    !donorRailAxis ||
    donorRailAxis !== branchRailAxis ||
    donorRailAxis === donorDepartureAxis
  ) {
    return null
  }
  // A return bus has another rail with this orientation near its far
  // endpoint. Moving only the first rail would partially rewrite a shape that
  // must be evaluated as a whole by the endpoint-bus transformation.
  let branchParallelRailCount = 0
  for (let index = 1; index < branchPath.length - 2; index++) {
    if (
      getSegmentAxis(branchPath[index]!, branchPath[index + 1]!) ===
      branchRailAxis
    ) {
      branchParallelRailCount++
    }
  }
  if (branchParallelRailCount !== 1) return null

  const railCoordinateAxis = donorRailAxis === "x" ? "y" : "x"
  const donorCoordinate = donorPath[1]![railCoordinateAxis]
  const branchCoordinate = branchPath[1]![railCoordinateAxis]
  const railOffset = Math.abs(donorCoordinate - branchCoordinate)
  if (
    nearlyEqual(donorCoordinate, branchCoordinate) ||
    railOffset > MAX_SHARED_ENDPOINT_RAIL_OFFSET
  ) {
    return null
  }

  const donorRange = [
    donorPath[1]![donorRailAxis],
    donorPath[2]![donorRailAxis],
  ].sort((a, b) => a - b)
  const branchRange = [
    branchPath[1]![branchRailAxis],
    branchPath[2]![branchRailAxis],
  ].sort((a, b) => a - b)
  const railsTouchAfterAlignment =
    Math.min(donorRange[1]!, branchRange[1]!) >=
    Math.max(donorRange[0]!, branchRange[0]!) - 1e-6
  if (!railsTouchAfterAlignment) return null

  const candidateFromShared = simplifyPath(
    branchPath.map((point, index) =>
      index === 1 || index === 2
        ? { ...point, [railCoordinateAxis]: donorCoordinate }
        : point,
    ),
  )
  return branchTrace.pins[0]!.pinId === sharedPin.pinId
    ? candidateFromShared
    : candidateFromShared.reverse()
}

/**
 * Remove the jog between a routed trace and an attached generated-label
 * connector. The connector must initially run along one donor segment, then
 * turn onto a nearby perpendicular rail whose interval touches the donor's
 * adjacent rail after alignment. Only the generated connector is changed.
 */
const getAlignedAttachedLabelConnectorPath = ({
  donorTrace,
  connectorTrace,
  netLabelConnectorTraceIds,
}: {
  donorTrace: SolvedTracePath
  connectorTrace: SolvedTracePath
  netLabelConnectorTraceIds: ReadonlySet<MspConnectionPairId>
}): Point[] | null => {
  if (
    netLabelConnectorTraceIds.has(donorTrace.mspPairId) ||
    !netLabelConnectorTraceIds.has(connectorTrace.mspPairId)
  ) {
    return null
  }

  const findCandidate = (connectorPath: Point[]) => {
    if (connectorPath.length < 3) return null
    const junction = connectorPath[0]!
    const turn = connectorPath[1]!
    const railEnd = connectorPath[2]!
    const departureAxis = getSegmentAxis(junction, turn)
    const railAxis = getSegmentAxis(turn, railEnd)
    if (!departureAxis || !railAxis || departureAxis === railAxis) return null

    const donorSegmentIndex = donorTrace.tracePath.findIndex(
      (point, index, path) => {
        const next = path[index + 1]
        return (
          next &&
          getSegmentAxis(point, next) === departureAxis &&
          tracePathContainsPoint([point, next], junction) &&
          tracePathContainsPoint([point, next], turn)
        )
      },
    )
    if (donorSegmentIndex < 0) return null

    const donorSegmentStart = donorTrace.tracePath[donorSegmentIndex]!
    const donorSegmentEnd = donorTrace.tracePath[donorSegmentIndex + 1]!
    // A connector already attached at a donor corner has no offset junction
    // to remove; moving its rail would rewrite the label's intended escape.
    if (
      (nearlyEqual(junction.x, donorSegmentStart.x) &&
        nearlyEqual(junction.y, donorSegmentStart.y)) ||
      (nearlyEqual(junction.x, donorSegmentEnd.x) &&
        nearlyEqual(junction.y, donorSegmentEnd.y))
    ) {
      return null
    }
    const adjacentDonorRails = [
      donorSegmentIndex > 0
        ? [donorTrace.tracePath[donorSegmentIndex - 1]!, donorSegmentStart]
        : null,
      donorSegmentIndex + 2 < donorTrace.tracePath.length
        ? [donorSegmentEnd, donorTrace.tracePath[donorSegmentIndex + 2]!]
        : null,
    ].flatMap((segment) =>
      segment && getSegmentAxis(segment[0], segment[1]) === railAxis
        ? [segment as [Point, Point]]
        : [],
    )
    if (adjacentDonorRails.length === 0) return null

    const railCoordinateAxis = railAxis === "x" ? "y" : "x"
    const connectorRailCoordinate = turn[railCoordinateAxis]
    const connectorRange = [turn[railAxis], railEnd[railAxis]].sort(
      (a, b) => a - b,
    )
    const donorRail = adjacentDonorRails
      .map((segment) => ({
        segment,
        coordinate: segment[0][railCoordinateAxis],
        offset: Math.abs(
          segment[0][railCoordinateAxis] - connectorRailCoordinate,
        ),
      }))
      .filter(({ segment, offset }) => {
        if (offset > MAX_SHARED_ENDPOINT_RAIL_OFFSET) return false
        const donorRange = [segment[0][railAxis], segment[1][railAxis]].sort(
          (a, b) => a - b,
        )
        const overlapStart = Math.max(donorRange[0]!, connectorRange[0]!)
        const overlapEnd = Math.min(donorRange[1]!, connectorRange[1]!)
        // Join two end-to-end rails. Do not collapse a connector onto a donor
        // rail when their intervals already overlap, which would reposition a
        // deliberate label branch rather than remove a jog.
        return (
          overlapEnd >= overlapStart - 1e-6 &&
          Math.abs(overlapEnd - overlapStart) <= 1e-6
        )
      })
      .sort((a, b) => a.offset - b.offset)[0]
    if (!donorRail || nearlyEqual(donorRail.offset, 0)) return null

    return simplifyPath(
      connectorPath.map((point, index) =>
        index === 1 || index === 2
          ? { ...point, [railCoordinateAxis]: donorRail.coordinate }
          : point,
      ),
    )
  }

  const forwardPath = simplifyPath(connectorTrace.tracePath)
  const forwardCandidate = findCandidate(forwardPath)
  if (forwardCandidate) return forwardCandidate
  const reverseCandidate = findCandidate([...forwardPath].reverse())
  return reverseCandidate ? reverseCandidate.reverse() : null
}

const pathsIntersect = (firstPath: Point[], secondPath: Point[]) => {
  if (
    firstPath.some((point) => tracePathContainsPoint(secondPath, point)) ||
    secondPath.some((point) => tracePathContainsPoint(firstPath, point))
  ) {
    return true
  }
  for (let firstIndex = 1; firstIndex < firstPath.length; firstIndex++) {
    for (let secondIndex = 1; secondIndex < secondPath.length; secondIndex++) {
      if (
        getSegmentIntersection(
          firstPath[firstIndex - 1]!,
          firstPath[firstIndex]!,
          secondPath[secondIndex - 1]!,
          secondPath[secondIndex]!,
        )
      ) {
        return true
      }
    }
  }
  return false
}

/**
 * Keep generated label connectors joined when their host trace moves. Only a
 * connector endpoint is projected, and only along its existing first/last
 * segment, so the label and the rest of its route stay fixed.
 */
const preserveAttachedLabelConnectorJunctions = ({
  originalTrace,
  candidateTrace,
  traces,
  netLabelConnectorTraceIds,
}: {
  originalTrace: SolvedTracePath
  candidateTrace: SolvedTracePath
  traces: SolvedTracePath[]
  netLabelConnectorTraceIds: ReadonlySet<MspConnectionPairId>
}): SolvedTracePath[] | null => {
  let outputTraces = traces.map((trace) =>
    trace.mspPairId === originalTrace.mspPairId ? candidateTrace : trace,
  )

  for (const connector of traces) {
    if (
      connector.mspPairId === originalTrace.mspPairId ||
      !netLabelConnectorTraceIds.has(connector.mspPairId) ||
      connector.globalConnNetId !== originalTrace.globalConnNetId ||
      !pathsIntersect(originalTrace.tracePath, connector.tracePath) ||
      pathsIntersect(candidateTrace.tracePath, connector.tracePath)
    ) {
      continue
    }

    const endpointIndex = [0, connector.tracePath.length - 1].find((index) =>
      tracePathContainsPoint(
        originalTrace.tracePath,
        connector.tracePath[index]!,
      ),
    )
    if (endpointIndex === undefined) return null
    const originalJunction = connector.tracePath[endpointIndex]!
    const movedJunction = getMovedAnchorPointForReroute(
      originalJunction,
      originalTrace.tracePath,
      candidateTrace.tracePath,
    )
    if (!movedJunction) return null

    const neighborIndex = endpointIndex === 0 ? 1 : endpointIndex - 1
    const neighbor = connector.tracePath[neighborIndex]
    if (
      !neighbor ||
      getSegmentAxis(originalJunction, neighbor) !==
        getSegmentAxis(movedJunction, neighbor)
    ) {
      return null
    }

    const movedConnector = {
      ...connector,
      tracePath: connector.tracePath.map((point, index) =>
        index === endpointIndex ? movedJunction : point,
      ),
    }
    if (!pathsIntersect(candidateTrace.tracePath, movedConnector.tracePath)) {
      return null
    }
    outputTraces = outputTraces.map((trace) =>
      trace.mspPairId === connector.mspPairId ? movedConnector : trace,
    )
  }

  return outputTraces
}

type PerpendicularPinRail = {
  railCoordinate: number
}

const getPerpendicularPinRail = ({
  trace,
  endpointPin,
}: {
  trace: SolvedTracePath
  endpointPin: InputPin
}): PerpendicularPinRail | null => {
  const otherPin = getOtherPin({ trace, sharedPin: endpointPin })
  if (!otherPin) return null

  const startsAtEndpoint = trace.pins[0].pinId === endpointPin.pinId
  let endpointToOtherPath = simplifyPath(trace.tracePath)
  if (!startsAtEndpoint) endpointToOtherPath.reverse()
  if (endpointToOtherPath.length !== 3) return null

  const [endpoint, railPoint, other] = endpointToOtherPath
  const endpointFacing = endpointPin._facingDirection
  if (endpointFacing === "y+" || endpointFacing === "y-") {
    if (
      otherPin._facingDirection !== "x+" &&
      otherPin._facingDirection !== "x-"
    ) {
      return null
    }
    if (
      !isVertical(endpoint!, railPoint!) ||
      !isHorizontal(railPoint!, other!) ||
      !railIsOnFacingSide({ railY: railPoint!.y, pin: endpointPin })
    ) {
      return null
    }
    const approachesOtherFromFacingSide =
      otherPin._facingDirection === "x-"
        ? railPoint!.x < otherPin.x
        : railPoint!.x > otherPin.x
    return approachesOtherFromFacingSide
      ? { railCoordinate: railPoint!.y }
      : null
  }

  if (endpointFacing !== "x+" && endpointFacing !== "x-") return null
  if (
    otherPin._facingDirection !== "y+" &&
    otherPin._facingDirection !== "y-"
  ) {
    return null
  }
  if (!isHorizontal(endpoint!, railPoint!) || !isVertical(railPoint!, other!)) {
    return null
  }
  const railIsOnEndpointFacingSide =
    endpointFacing === "x+"
      ? railPoint!.x > endpointPin.x
      : railPoint!.x < endpointPin.x
  const approachesOtherFromFacingSide =
    otherPin._facingDirection === "y+"
      ? railPoint!.y > otherPin.y
      : railPoint!.y < otherPin.y
  return railIsOnEndpointFacingSide && approachesOtherFromFacingSide
    ? { railCoordinate: railPoint!.x }
    : null
}

/**
 * Level a bus between two same-axis pins with the perpendicular rails that
 * connect those endpoints to their loads. The candidate reuses both existing
 * endpoint stubs, so a long bus does not meet each stub on a nearby parallel
 * rail and leave a visible jog.
 */
const getAlignedPerpendicularEndpointBusPath = ({
  donorTrace,
  branchTrace,
  traces,
}: {
  donorTrace: SolvedTracePath
  branchTrace: SolvedTracePath
  traces: SolvedTracePath[]
}): Point[] | null => {
  const sharedPin = getSharedPin({ donorTrace, branchTrace })
  if (!sharedPin) return null
  const returnPin = getOtherPin({ trace: branchTrace, sharedPin })
  if (!returnPin) return null

  const getOtherSameNetTracesAtPin = (pin: InputPin) =>
    traces.filter(
      (trace) =>
        trace.mspPairId !== branchTrace.mspPairId &&
        trace.globalConnNetId === branchTrace.globalConnNetId &&
        trace.pinIds.includes(pin.pinId),
    )
  const sharedDonorTraces = getOtherSameNetTracesAtPin(sharedPin)
  const returnDonorTraces = getOtherSameNetTracesAtPin(returnPin)
  if (
    sharedDonorTraces.length !== 1 ||
    sharedDonorTraces[0]!.mspPairId !== donorTrace.mspPairId ||
    returnDonorTraces.length !== 1
  ) {
    return null
  }

  const sharedRail = getPerpendicularPinRail({
    trace: donorTrace,
    endpointPin: sharedPin,
  })
  if (!sharedRail) return null

  const facing = sharedPin._facingDirection
  const verticalEndpoints = facing === "y+" || facing === "y-"
  const horizontalEndpoints = facing === "x+" || facing === "x-"
  if (!verticalEndpoints && !horizontalEndpoints) return null
  if (
    verticalEndpoints !==
    (returnPin._facingDirection === "y+" || returnPin._facingDirection === "y-")
  ) {
    return null
  }

  const branchStartsAtSharedPin = branchTrace.pins[0].pinId === sharedPin.pinId
  let sharedToReturnPath = simplifyPath(branchTrace.tracePath)
  if (!branchStartsAtSharedPin) sharedToReturnPath.reverse()
  if (sharedToReturnPath.length !== 6) return null

  const expectedSegmentOrientations = verticalEndpoints
    ? ["V", "H", "V", "H", "V"]
    : ["H", "V", "H", "V", "H"]
  const actualSegmentOrientations = sharedToReturnPath
    .slice(1)
    .map((point, index) =>
      isHorizontal(sharedToReturnPath[index]!, point)
        ? "H"
        : isVertical(sharedToReturnPath[index]!, point)
          ? "V"
          : "D",
    )
  if (
    actualSegmentOrientations.some(
      (orientation, index) =>
        orientation !== expectedSegmentOrientations[index],
    )
  ) {
    return null
  }

  const returnRail = getPerpendicularPinRail({
    trace: returnDonorTraces[0]!,
    endpointPin: returnPin,
  })
  if (!returnRail) return null

  const candidate = verticalEndpoints
    ? simplifyPath([
        { x: sharedPin.x, y: sharedPin.y },
        { x: sharedPin.x, y: sharedRail.railCoordinate },
        { x: sharedToReturnPath[2]!.x, y: sharedRail.railCoordinate },
        { x: sharedToReturnPath[3]!.x, y: returnRail.railCoordinate },
        { x: returnPin.x, y: returnRail.railCoordinate },
        { x: returnPin.x, y: returnPin.y },
      ])
    : simplifyPath([
        { x: sharedPin.x, y: sharedPin.y },
        { x: sharedRail.railCoordinate, y: sharedPin.y },
        { x: sharedRail.railCoordinate, y: sharedToReturnPath[2]!.y },
        { x: returnRail.railCoordinate, y: sharedToReturnPath[3]!.y },
        { x: returnRail.railCoordinate, y: returnPin.y },
        { x: returnPin.x, y: returnPin.y },
      ])
  return branchStartsAtSharedPin ? candidate : candidate.reverse()
}

const candidateIsClear = ({
  candidateTrace,
  originalTrace,
  traces,
  inputProblem,
  originalNetLabelPlacements,
  candidateNetLabelPlacements,
  attachedLabelIndexes,
}: {
  candidateTrace: SolvedTracePath
  originalTrace: SolvedTracePath
  traces: SolvedTracePath[]
  inputProblem: InputProblem
  originalNetLabelPlacements: NetLabelPlacement[]
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

  // Moving an attached label is part of the reroute. It must not introduce a
  // collision with an unchanged trace, component, or neighboring label.
  const labelHitsTrace = (label: NetLabelPlacement, trace: SolvedTracePath) =>
    pathIntersectsAnyNetLabel({
      path: trace.tracePath,
      netLabelPlacements: [label],
    })
  for (const labelIndex of attachedLabelIndexes) {
    const originalLabel = originalNetLabelPlacements[labelIndex]!
    const candidateLabel = candidateNetLabelPlacements[labelIndex]!
    const originalBounds = getRectBounds(
      originalLabel.center,
      originalLabel.width,
      originalLabel.height,
    )
    const candidateBounds = getRectBounds(
      candidateLabel.center,
      candidateLabel.width,
      candidateLabel.height,
    )

    for (const trace of traces) {
      if (trace.globalConnNetId === candidateLabel.globalConnNetId) continue
      if (
        labelHitsTrace(candidateLabel, trace) &&
        !labelHitsTrace(originalLabel, trace)
      ) {
        return false
      }
    }
    for (const obstacle of obstacles) {
      if (
        rectsOverlap(candidateBounds, obstacle) &&
        !rectsOverlap(originalBounds, obstacle)
      ) {
        return false
      }
    }
    for (
      let otherIndex = 0;
      otherIndex < candidateNetLabelPlacements.length;
      otherIndex++
    ) {
      if (otherIndex === labelIndex) continue
      const originalOther = originalNetLabelPlacements[otherIndex]!
      const candidateOther = candidateNetLabelPlacements[otherIndex]!
      const originalOtherBounds = getRectBounds(
        originalOther.center,
        originalOther.width,
        originalOther.height,
      )
      const candidateOtherBounds = getRectBounds(
        candidateOther.center,
        candidateOther.width,
        candidateOther.height,
      )
      if (
        rectsOverlap(candidateBounds, candidateOtherBounds) &&
        !rectsOverlap(originalBounds, originalOtherBounds)
      ) {
        return false
      }
    }
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
  netLabelConnectorTraceIds,
}: AlignSameNetJunctionsInput) => {
  let outputTraces = [...traces]
  let outputNetLabelPlacements = [...netLabelPlacements]
  let alignedJunctionCount = 0
  const alignedBranchTraceIds = new Set<string>()

  // First level the load rails, then attach return branches to those final
  // rails. Doing this in one pass could attach a branch to a rail that moves later.
  for (const alignReturnBranches of [false, true]) {
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
        const donorIsLabelConnector = netLabelConnectorTraceIds.has(
          donorTrace.mspPairId,
        )
        const branchIsLabelConnector = netLabelConnectorTraceIds.has(
          branchTrace.mspPairId,
        )
        const candidatePaths = branchIsLabelConnector
          ? alignReturnBranches && !donorIsLabelConnector
            ? [
                getAlignedAttachedLabelConnectorPath({
                  donorTrace,
                  connectorTrace: branchTrace,
                  netLabelConnectorTraceIds,
                }),
              ]
            : []
          : donorIsLabelConnector
            ? []
            : alignReturnBranches
              ? [
                  ...[1, 0.5, 0.25].map((returnStemScale) =>
                    getAlignedReturnBranchPath({
                      donorTrace,
                      branchTrace,
                      returnStemScale,
                    }),
                  ),
                  getAlignedPerpendicularEndpointBusPath({
                    donorTrace,
                    branchTrace,
                    traces: outputTraces,
                  }),
                  getAlignedSharedEndpointRailPath({
                    donorTrace,
                    branchTrace,
                    netLabelConnectorTraceIds,
                  }),
                ]
              : [
                  getAlignedBranchPath({ donorTrace, branchTrace }),
                  getAlignedParallelPinExitPath({ donorTrace, branchTrace }),
                ]
        for (const candidatePath of candidatePaths) {
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
          const candidateTraces = preserveAttachedLabelConnectorJunctions({
            originalTrace: branchTrace,
            candidateTrace,
            traces: outputTraces,
            netLabelConnectorTraceIds,
          })
          if (!candidateTraces) continue
          if (
            !candidateIsClear({
              candidateTrace,
              originalTrace: branchTrace,
              traces: candidateTraces,
              inputProblem,
              originalNetLabelPlacements: outputNetLabelPlacements,
              candidateNetLabelPlacements,
              attachedLabelIndexes,
            })
          ) {
            continue
          }

          const movedConnectorsAreClear = candidateTraces.every((trace) => {
            if (
              trace.mspPairId === branchTrace.mspPairId ||
              !netLabelConnectorTraceIds.has(trace.mspPairId)
            ) {
              return true
            }
            const originalConnector = outputTraces.find(
              (originalTrace) => originalTrace.mspPairId === trace.mspPairId,
            )!
            if (originalConnector.tracePath === trace.tracePath) return true
            return candidateIsClear({
              candidateTrace: trace,
              originalTrace: originalConnector,
              traces: candidateTraces,
              inputProblem,
              originalNetLabelPlacements: outputNetLabelPlacements,
              candidateNetLabelPlacements,
              attachedLabelIndexes: getAttachedLabelIndexes(
                originalConnector,
                outputNetLabelPlacements,
              ),
            })
          })
          if (!movedConnectorsAreClear) continue

          outputTraces = candidateTraces
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
