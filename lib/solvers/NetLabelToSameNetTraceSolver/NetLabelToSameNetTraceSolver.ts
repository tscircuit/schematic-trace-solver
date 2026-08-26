import {
  doesSegmentIntersectRect,
  doSegmentsIntersect,
  getBoundFromCenteredRect,
  pointToSegmentClosestPoint,
  pointToSegmentDistance,
  type Point,
} from "@tscircuit/math-utils"
import type { ConnectivityMap } from "connectivity-map"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { doesPairCrossRestrictedCenterLines } from "lib/solvers/MspConnectionPairSolver/doesPairCrossRestrictedCenterLines"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  getTraceRecoveryConnectivityMaps,
  type TraceRecoveryPin,
} from "lib/solvers/NetLabelTraceRecovery/getTraceRecoveryConnectivityMaps"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { SchematicTraceSingleLineSolver2 } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import {
  pointsAreEqual,
  segmentsOverlapBeyondEndpoint,
} from "lib/solvers/UnroutedTraceRecoverySolver/UnroutedTraceRecoverySolver"
import type {
  ChipId,
  InputChip,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import { arePinsInDifferentSchematicSections } from "lib/utils/arePinsInDifferentSchematicSections"
import type { FacingDirection } from "lib/utils/dir"
import {
  type InlineNetLabelOutput,
  visualizeInlineNetLabelOutput,
} from "../InlineNetLabelSolver/InlineNetLabelSolver"
import { pathIntersectsRenderedLabel } from "../NetLabelToTraceSolver/NetLabelToTraceSolver"

const EPSILON = 1e-9
const MAX_CONTINUATION_OFFSET = 0.15
const TARGET_JUNCTION_INSET = 0.2
const AVAILABLE_NET_ORIENTATION_PREFIX = "available-net-orientation-"
const RECOVERED_TRACE_PREFIX = "net-label-trace-junction-"
// Standalone ports may join nearby copper, but a distant connection remains a
// deliberate net-label boundary rather than becoming a page-spanning trace.
const MAX_PORT_TO_TRACE_DISTANCE = 5

interface TraceComponent {
  id: number
  globalConnNetId: SolvedTracePath["globalConnNetId"]
  traces: SolvedTracePath[]
}

type GlobalConnNetId = NetLabelPlacement["globalConnNetId"]

interface JunctionCandidate {
  sourceLabel: NetLabelPlacement
  sourceComponentId: number | null
  targetComponentId: number
  sourcePin: TraceRecoveryPin
  targetPin: TraceRecoveryPin
  targetTrace: SolvedTracePath
  sourcePoint: Point
  targetPoint: Point
  perpendicularOffset: number
  routeDistance: number
  key: string
}

const pathIsAxisAligned = (path: Point[]) =>
  path.every(
    (point, index) =>
      index === 0 ||
      isHorizontal(point, path[index - 1]!) ||
      isVertical(point, path[index - 1]!),
  )

const orthogonalizeNearAlignedContinuation = (
  path: Point[],
  candidate: JunctionCandidate,
) => {
  if (
    path.length !== 2 ||
    pathIsAxisAligned(path) ||
    candidate.sourceComponentId === null ||
    candidate.perpendicularOffset > MAX_CONTINUATION_OFFSET
  ) {
    return path
  }

  const [start, end] = path as [Point, Point]
  const elbow =
    candidate.sourcePin._facingDirection === "x+" ||
    candidate.sourcePin._facingDirection === "x-"
      ? { x: end.x, y: start.y }
      : { x: start.x, y: end.y }
  return [start, elbow, end]
}

const tracesTouch = (first: SolvedTracePath, second: SolvedTracePath) => {
  if (first.pinIds.some((pinId) => second.pinIds.includes(pinId))) return true
  for (
    let firstIndex = 0;
    firstIndex < first.tracePath.length - 1;
    firstIndex++
  ) {
    for (
      let secondIndex = 0;
      secondIndex < second.tracePath.length - 1;
      secondIndex++
    ) {
      if (
        doSegmentsIntersect(
          first.tracePath[firstIndex]!,
          first.tracePath[firstIndex + 1]!,
          second.tracePath[secondIndex]!,
          second.tracePath[secondIndex + 1]!,
        )
      ) {
        return true
      }
    }
  }
  return false
}

const getAdjacentTracePoint = (
  trace: SolvedTracePath,
  pin: TraceRecoveryPin,
): Point | null => {
  if (pointsAreEqual(trace.tracePath[0]!, pin)) {
    return trace.tracePath[1] ?? null
  }
  if (pointsAreEqual(trace.tracePath.at(-1)!, pin)) {
    return trace.tracePath.at(-2) ?? null
  }
  return null
}

const getTargetJunctionAwayFromPin = (
  trace: SolvedTracePath,
  pin: TraceRecoveryPin,
): Point | null => {
  let points: Point[]
  if (pointsAreEqual(trace.tracePath[0]!, pin)) {
    points = trace.tracePath
  } else if (pointsAreEqual(trace.tracePath.at(-1)!, pin)) {
    points = [...trace.tracePath].reverse()
  } else {
    return null
  }

  const segmentStart = points.length >= 3 ? points[1]! : points[0]!
  const segmentEnd = points.length >= 3 ? points[2]! : points[1]
  if (!segmentEnd) return null
  const segmentLength =
    Math.abs(segmentEnd.x - segmentStart.x) +
    Math.abs(segmentEnd.y - segmentStart.y)
  if (segmentLength <= EPSILON) return segmentEnd
  const inset = Math.min(TARGET_JUNCTION_INSET, segmentLength / 2)
  return {
    x:
      segmentStart.x +
      ((segmentEnd.x - segmentStart.x) / segmentLength) * inset,
    y:
      segmentStart.y +
      ((segmentEnd.y - segmentStart.y) / segmentLength) * inset,
  }
}

const directionToward = (from: Point, to: Point): FacingDirection => {
  const deltaX = to.x - from.x
  const deltaY = to.y - from.y
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    if (deltaX >= 0) return "x+"
    return "x-"
  }
  if (deltaY >= 0) return "y+"
  return "y-"
}

const getDirectionPreferenceScore = ({
  direction,
  deltaX,
  deltaY,
}: {
  direction: FacingDirection
  deltaX: number
  deltaY: number
}) => {
  if (direction === "x+") return deltaX
  if (direction === "x-") return -deltaX
  if (direction === "y+") return deltaY
  return -deltaY
}

const getAvailableJunctionDirection = ({
  trace,
  junctionPoint,
  sourcePoint,
}: {
  trace: SolvedTracePath
  junctionPoint: Point
  sourcePoint: Point
}): FacingDirection => {
  const occupiedDirections = new Set<FacingDirection>()
  for (let index = 0; index < trace.tracePath.length - 1; index++) {
    const start = trace.tracePath[index]!
    const end = trace.tracePath[index + 1]!
    if (pointToSegmentDistance(junctionPoint, start, end) > EPSILON) continue
    if (!pointsAreEqual(junctionPoint, start)) {
      occupiedDirections.add(directionToward(junctionPoint, start))
    }
    if (!pointsAreEqual(junctionPoint, end)) {
      occupiedDirections.add(directionToward(junctionPoint, end))
    }
  }

  const deltaX = sourcePoint.x - junctionPoint.x
  const deltaY = sourcePoint.y - junctionPoint.y
  const directionsByPreference: FacingDirection[] = ["x+", "x-", "y+", "y-"]
  directionsByPreference.sort(
    (first, second) =>
      getDirectionPreferenceScore({ direction: second, deltaX, deltaY }) -
      getDirectionPreferenceScore({ direction: first, deltaX, deltaY }),
  )

  return (
    directionsByPreference.find(
      (direction) => !occupiedDirections.has(direction),
    ) ?? directionToward(junctionPoint, sourcePoint)
  )
}

const isPointInDirection = ({
  origin,
  point,
  direction,
}: {
  origin: Point
  point: Point
  direction: FacingDirection
}) => {
  if (direction === "x+") return point.x >= origin.x - EPSILON
  if (direction === "x-") return point.x <= origin.x + EPSILON
  if (direction === "y+") return point.y >= origin.y - EPSILON
  return point.y <= origin.y + EPSILON
}

const getPerpendicularOffset = ({
  source,
  target,
  direction,
}: {
  source: Point
  target: Point
  direction: FacingDirection
}) => {
  if (direction === "x+" || direction === "x-") {
    return Math.abs(source.y - target.y)
  }
  return Math.abs(source.x - target.x)
}

const isPointOnExteriorSideOfLabelAnchor = ({
  point,
  label,
}: {
  point: Point
  label: NetLabelPlacement
}) => {
  if (label.orientation === "x+") {
    return point.x <= label.anchorPoint.x + EPSILON
  }
  if (label.orientation === "x-") {
    return point.x >= label.anchorPoint.x - EPSILON
  }
  if (label.orientation === "y+") {
    return point.y <= label.anchorPoint.y + EPSILON
  }
  return point.y >= label.anchorPoint.y - EPSILON
}

const pathIntersectsRetainedLabelBeyondAnchor = (
  path: Point[],
  label: NetLabelPlacement,
) => {
  const bounds = getBoundFromCenteredRect({
    center: label.center,
    width: label.width,
    height: label.height,
  })
  for (let pathIndex = 0; pathIndex < path.length - 1; pathIndex++) {
    const start = path[pathIndex]!
    const end = path[pathIndex + 1]!
    if (!doesSegmentIntersectRect(start, end, bounds)) continue

    const startIsExterior = isPointOnExteriorSideOfLabelAnchor({
      point: start,
      label,
    })
    const endIsExterior = isPointOnExteriorSideOfLabelAnchor({
      point: end,
      label,
    })
    if (!startIsExterior || !endIsExterior) return true
  }
  return false
}

export class NetLabelToSameNetTraceSolver extends BaseSolver {
  inputProblem: InputProblem

  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]

  private chipMap: Record<ChipId, InputChip>
  private pinMap: Map<PinId, TraceRecoveryPin>
  private components: TraceComponent[] = []
  private componentIdByTrace = new Map<SolvedTracePath, number>()
  private componentParents: number[]
  private retainedLabels = new Set<NetLabelPlacement>()
  private queuedCandidates: JunctionCandidate[]
  private currentCandidate: JunctionCandidate | null = null
  declare activeSubSolver: SchematicTraceSingleLineSolver2 | null

  constructor(private input: InlineNetLabelOutput) {
    super()
    this.inputProblem = input.inputProblem
    this.outputTraces = [...input.traces]
    this.outputNetLabelPlacements = [...input.netLabelPlacements]

    const { chipMap, pinMap } = getTraceRecoveryConnectivityMaps(
      this.inputProblem,
    )
    this.chipMap = chipMap
    this.pinMap = pinMap

    this.buildTraceComponents()
    this.componentParents = this.components.map((component) => component.id)
    const { netConnMap } = getConnectivityMapsFromInputProblem(
      this.inputProblem,
    )
    this.reserveProtectedNetLabels(netConnMap)
    this.queuedCandidates = this.buildCandidates(netConnMap)
    this.stats.candidateCount = this.queuedCandidates.length
    this.stats.recoveredTraceCount = 0
  }

  override getConstructorParams(): [InlineNetLabelOutput] {
    return [this.input]
  }

  private buildTraceComponents() {
    const unassignedTraces = new Set(this.input.traces)
    while (unassignedTraces.size > 0) {
      const firstTrace = unassignedTraces.values().next().value!
      unassignedTraces.delete(firstTrace)
      const component: TraceComponent = {
        id: this.components.length,
        globalConnNetId: firstTrace.globalConnNetId,
        traces: [],
      }
      const queuedTraces = [firstTrace]
      while (queuedTraces.length > 0) {
        const trace = queuedTraces.shift()!
        component.traces.push(trace)
        this.componentIdByTrace.set(trace, component.id)
        for (const candidateTrace of unassignedTraces) {
          if (
            candidateTrace.globalConnNetId === component.globalConnNetId &&
            tracesTouch(trace, candidateTrace)
          ) {
            unassignedTraces.delete(candidateTrace)
            queuedTraces.push(candidateTrace)
          }
        }
      }
      this.components.push(component)
    }
  }

  private shouldRetainNetLabel({
    label,
    netConnMap,
  }: {
    label: NetLabelPlacement
    netConnMap: ConnectivityMap
  }) {
    if (!label.netId) return false
    if (
      this.inputProblem.availableNetLabelOrientations[label.netId]?.includes(
        "y+",
      )
    ) {
      return true
    }
    return [
      ...this.inputProblem.directConnections,
      ...this.inputProblem.netConnections,
    ].some(
      (connection) =>
        connection.isPowerNet === true &&
        connection.netId !== undefined &&
        netConnMap.getNetConnectedToId(connection.netId) ===
          label.globalConnNetId,
    )
  }

  private reserveProtectedNetLabels(netConnMap: ConnectivityMap) {
    const labelsByGlobalNetId = new Map<GlobalConnNetId, NetLabelPlacement[]>()
    for (const label of this.outputNetLabelPlacements) {
      if (!this.shouldRetainNetLabel({ label, netConnMap })) continue
      const labels = labelsByGlobalNetId.get(label.globalConnNetId) ?? []
      labels.push(label)
      labelsByGlobalNetId.set(label.globalConnNetId, labels)
    }

    for (const labels of labelsByGlobalNetId.values()) {
      labels.sort(
        (first, second) =>
          second.anchorPoint.y - first.anchorPoint.y ||
          Number(second.orientation === "y+") -
            Number(first.orientation === "y+") ||
          Number(second.mspConnectionPairIds.length > 0) -
            Number(first.mspConnectionPairIds.length > 0),
      )
      this.retainedLabels.add(labels[0]!)
    }
  }

  private isEligibleLabel({
    label,
    netConnMap,
    groundNetId,
  }: {
    label: NetLabelPlacement
    netConnMap: ConnectivityMap
    groundNetId?: GlobalConnNetId
  }) {
    if (
      !label.netId ||
      label.netId === "GND" ||
      label.globalConnNetId === groundNetId ||
      (label.mspConnectionPairIds.length === 0 && label.pinIds.length !== 1)
    ) {
      return false
    }
    return this.inputProblem.directConnections.some((connection) => {
      if (!connection.netId) return false
      return (
        netConnMap.getNetConnectedToId(connection.netId) ===
          label.globalConnNetId &&
        connection.pinIds.some((pinId) => label.pinIds.includes(pinId))
      )
    })
  }

  private getLabelComponent(label: NetLabelPlacement) {
    const trace = this.input.traces.find((trace) =>
      trace.mspConnectionPairIds.some((id) =>
        label.mspConnectionPairIds.includes(id),
      ),
    )
    if (!trace) return null
    const componentId = this.componentIdByTrace.get(trace)
    if (componentId === undefined) return null
    return this.components[componentId]!
  }

  private getClosestTarget(
    sourcePoint: Point,
    targetComponent: TraceComponent,
  ) {
    let best:
      | { point: Point; trace: SolvedTracePath; distance: number }
      | undefined
    for (const trace of targetComponent.traces) {
      for (let index = 0; index < trace.tracePath.length - 1; index++) {
        const point = pointToSegmentClosestPoint(
          sourcePoint,
          trace.tracePath[index]!,
          trace.tracePath[index + 1]!,
        )
        const distance =
          Math.abs(sourcePoint.x - point.x) + Math.abs(sourcePoint.y - point.y)
        if (!best || distance < best.distance - EPSILON) {
          best = { point, trace, distance }
        }
      }
    }

    if (best) {
      const targetPin = this.getClosestTargetPin(best.trace, best.point)
      if (targetPin && pointsAreEqual(best.point, targetPin)) {
        const targetJunction = getTargetJunctionAwayFromPin(
          best.trace,
          targetPin,
        )
        if (targetJunction) {
          best = {
            ...best,
            point: targetJunction,
            distance:
              Math.abs(sourcePoint.x - targetJunction.x) +
              Math.abs(sourcePoint.y - targetJunction.y),
          }
        }
      }
    }

    return best
  }

  private getClosestTargetPin(
    targetTrace: SolvedTracePath,
    targetPoint: Point,
  ) {
    return targetTrace.pinIds
      .map((pinId) => this.pinMap.get(pinId))
      .filter((pin): pin is TraceRecoveryPin => pin !== undefined)
      .sort(
        (first, second) =>
          Math.abs(first.x - targetPoint.x) +
          Math.abs(first.y - targetPoint.y) -
          Math.abs(second.x - targetPoint.x) -
          Math.abs(second.y - targetPoint.y),
      )[0]
  }

  private pinsCanShareJunction(
    sourcePin: TraceRecoveryPin,
    targetPin: TraceRecoveryPin | undefined,
  ): targetPin is TraceRecoveryPin {
    return Boolean(
      targetPin &&
        targetPin.pinId !== sourcePin.pinId &&
        !arePinsInDifferentSchematicSections(
          this.inputProblem,
          sourcePin,
          targetPin,
        ) &&
        !doesPairCrossRestrictedCenterLines({
          inputProblem: this.inputProblem,
          chipMap: this.chipMap,
          pinIdMap: this.pinMap,
          p1: sourcePin,
          p2: targetPin,
        }),
    )
  }

  private buildCandidates(netConnMap: ConnectivityMap) {
    const groundNetId = netConnMap.getNetConnectedToId("GND") ?? undefined
    const candidates: JunctionCandidate[] = []

    for (const label of this.input.netLabelPlacements) {
      if (!this.isEligibleLabel({ label, netConnMap, groundNetId })) continue

      if (label.mspConnectionPairIds.length === 0) {
        const sourcePin = this.pinMap.get(label.pinIds[0]!)
        if (!sourcePin) continue
        for (const targetComponent of this.components) {
          if (targetComponent.globalConnNetId !== label.globalConnNetId) {
            continue
          }
          const closestTarget = this.getClosestTarget(
            sourcePin,
            targetComponent,
          )
          if (!closestTarget) continue
          if (closestTarget.distance > MAX_PORT_TO_TRACE_DISTANCE) continue
          const targetPin = this.getClosestTargetPin(
            closestTarget.trace,
            closestTarget.point,
          )
          if (!this.pinsCanShareJunction(sourcePin, targetPin)) continue

          candidates.push({
            sourceLabel: label,
            sourceComponentId: null,
            targetComponentId: targetComponent.id,
            sourcePin,
            targetPin,
            targetTrace: closestTarget.trace,
            sourcePoint: sourcePin,
            targetPoint: closestTarget.point,
            perpendicularOffset: getPerpendicularOffset({
              source: sourcePin,
              target: closestTarget.point,
              direction: sourcePin._facingDirection,
            }),
            routeDistance: closestTarget.distance,
            key: [
              `port-${sourcePin.pinId}`,
              closestTarget.trace.mspPairId,
            ].join("--"),
          })
        }
        continue
      }

      const sourceComponent = this.getLabelComponent(label)
      if (!sourceComponent) continue

      for (const sourceTrace of sourceComponent.traces) {
        for (const sourcePinId of sourceTrace.pinIds) {
          const sourcePin = this.pinMap.get(sourcePinId)
          if (!sourcePin) continue
          const sourcePoint = getAdjacentTracePoint(sourceTrace, sourcePin)
          if (!sourcePoint) continue
          if (pointsAreEqual(sourcePoint, sourcePin)) continue
          if (
            !isPointInDirection({
              origin: sourcePin,
              point: sourcePoint,
              direction: sourcePin._facingDirection,
            })
          ) {
            continue
          }

          for (const targetComponent of this.components) {
            if (
              targetComponent.id === sourceComponent.id ||
              targetComponent.globalConnNetId !==
                sourceComponent.globalConnNetId
            ) {
              continue
            }
            const closestTarget = this.getClosestTarget(
              sourcePoint,
              targetComponent,
            )
            if (!closestTarget) continue
            if (
              !isPointInDirection({
                origin: sourcePoint,
                point: closestTarget.point,
                direction: sourcePin._facingDirection,
              })
            ) {
              continue
            }
            const perpendicularOffset = getPerpendicularOffset({
              source: sourcePoint,
              target: closestTarget.point,
              direction: sourcePin._facingDirection,
            })
            if (perpendicularOffset > MAX_CONTINUATION_OFFSET) continue

            const targetPin = this.getClosestTargetPin(
              closestTarget.trace,
              closestTarget.point,
            )
            if (!this.pinsCanShareJunction(sourcePin, targetPin)) continue

            const key = [
              label.mspConnectionPairIds.join("+"),
              sourcePin.pinId,
              closestTarget.trace.mspPairId,
            ].join("--")
            candidates.push({
              sourceLabel: label,
              sourceComponentId: sourceComponent.id,
              targetComponentId: targetComponent.id,
              sourcePin,
              targetPin,
              targetTrace: closestTarget.trace,
              sourcePoint,
              targetPoint: closestTarget.point,
              perpendicularOffset,
              routeDistance: closestTarget.distance,
              key,
            })
          }
        }
      }
    }

    return candidates.sort(
      (first, second) =>
        Number(first.sourceComponentId === null) -
          Number(second.sourceComponentId === null) ||
        first.perpendicularOffset - second.perpendicularOffset ||
        first.routeDistance - second.routeDistance ||
        first.key.localeCompare(second.key),
    )
  }

  private findComponent(componentId: number): number {
    if (this.componentParents[componentId] !== componentId) {
      this.componentParents[componentId] = this.findComponent(
        this.componentParents[componentId]!,
      )
    }
    return this.componentParents[componentId]!
  }

  private unionComponents(firstId: number, secondId: number) {
    const firstRoot = this.findComponent(firstId)
    const secondRoot = this.findComponent(secondId)
    if (firstRoot !== secondRoot) this.componentParents[secondRoot] = firstRoot
  }

  private isSourceLabelConnectorTrace(
    trace: SolvedTracePath,
    sourceLabel: NetLabelPlacement,
  ) {
    if (!trace.mspPairId.startsWith(AVAILABLE_NET_ORIENTATION_PREFIX)) {
      return false
    }
    if (trace.globalConnNetId !== sourceLabel.globalConnNetId) return false
    if (trace.pinIds.length !== sourceLabel.pinIds.length) return false
    return trace.pinIds.every((pinId) => sourceLabel.pinIds.includes(pinId))
  }

  private pathCrossesExistingTraces(
    path: Point[],
    candidate: JunctionCandidate,
  ) {
    for (const trace of this.outputTraces) {
      if (this.isSourceLabelConnectorTrace(trace, candidate.sourceLabel)) {
        continue
      }
      const componentId = this.componentIdByTrace.get(trace)
      let allowedJunction: Point | undefined
      if (
        candidate.sourceComponentId !== null &&
        componentId === candidate.sourceComponentId
      ) {
        allowedJunction = candidate.sourcePoint
      }
      if (componentId === candidate.targetComponentId) {
        allowedJunction = candidate.targetPoint
      }

      for (let pathIndex = 0; pathIndex < path.length - 1; pathIndex++) {
        const pathStart = path[pathIndex]!
        const pathEnd = path[pathIndex + 1]!
        for (
          let tracePointIndex = 0;
          tracePointIndex < trace.tracePath.length - 1;
          tracePointIndex++
        ) {
          const traceStart = trace.tracePath[tracePointIndex]!
          const traceEnd = trace.tracePath[tracePointIndex + 1]!
          if (!doSegmentsIntersect(pathStart, pathEnd, traceStart, traceEnd)) {
            continue
          }
          const allowedPointContact =
            allowedJunction !== undefined &&
            (pointsAreEqual(pathStart, allowedJunction) ||
              pointsAreEqual(pathEnd, allowedJunction)) &&
            pointToSegmentDistance(allowedJunction, traceStart, traceEnd) <=
              EPSILON &&
            !segmentsOverlapBeyondEndpoint({
              firstStart: pathStart,
              firstEnd: pathEnd,
              secondStart: traceStart,
              secondEnd: traceEnd,
            })
          if (!allowedPointContact) return true
        }
      }
    }

    return false
  }

  private routeIntersectsRemainingLabels(
    path: Point[],
    sourceLabel: NetLabelPlacement,
  ) {
    for (const label of this.outputNetLabelPlacements) {
      if (
        this.retainedLabels.has(label) &&
        label.globalConnNetId === sourceLabel.globalConnNetId
      ) {
        if (pathIntersectsRetainedLabelBeyondAnchor(path, label)) return true
        continue
      }
      if (label === sourceLabel) continue
      if (pathIntersectsRenderedLabel(path, label)) return true
    }
    return this.input.inlineNetLabelPlacements.some((label) =>
      pathIntersectsRenderedLabel(path, label),
    )
  }

  private tryAcceptCurrentRoute() {
    const candidate = this.currentCandidate
    const solvedTracePath = this.activeSubSolver?.solvedTracePath
    if (!candidate || !solvedTracePath) return
    const tracePath = orthogonalizeNearAlignedContinuation(
      solvedTracePath,
      candidate,
    )
    if (
      !pathIsAxisAligned(tracePath) ||
      this.pathCrossesExistingTraces(tracePath, candidate) ||
      this.routeIntersectsRemainingLabels(tracePath, candidate.sourceLabel)
    ) {
      return
    }

    const mspPairId = `${RECOVERED_TRACE_PREFIX}${candidate.key}`
    const recoveredTrace: SolvedTracePath = {
      mspPairId,
      dcConnNetId:
        candidate.sourceLabel.dcConnNetId ??
        candidate.sourceLabel.globalConnNetId,
      globalConnNetId: candidate.sourceLabel.globalConnNetId,
      userNetId: candidate.sourceLabel.netId,
      pins: [candidate.sourcePin, candidate.targetPin],
      tracePath,
      mspConnectionPairIds: [mspPairId],
      pinIds: [candidate.sourcePin.pinId, candidate.targetPin.pinId],
    }
    const shouldRemoveSourceLabelConnector = !this.retainedLabels.has(
      candidate.sourceLabel,
    )
    this.outputTraces = this.outputTraces.filter(
      (trace) =>
        !shouldRemoveSourceLabelConnector ||
        !this.isSourceLabelConnectorTrace(trace, candidate.sourceLabel),
    )
    this.outputTraces.push(recoveredTrace)
    this.outputNetLabelPlacements = this.outputNetLabelPlacements.filter(
      (label) => {
        if (this.retainedLabels.has(label)) return true
        if (label === candidate.sourceLabel) return false
        if (label.globalConnNetId !== candidate.sourceLabel.globalConnNetId) {
          return true
        }
        return this.getLabelComponent(label)?.id !== candidate.targetComponentId
      },
    )
    if (candidate.sourceComponentId !== null) {
      this.unionComponents(
        candidate.sourceComponentId,
        candidate.targetComponentId,
      )
    }
    this.stats.recoveredTraceCount++
  }

  override _step() {
    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      if (this.activeSubSolver.solved) {
        this.tryAcceptCurrentRoute()
        this.activeSubSolver = null
        this.currentCandidate = null
      } else if (this.activeSubSolver.failed) {
        this.activeSubSolver = null
        this.currentCandidate = null
      }
      return
    }

    let candidate = this.queuedCandidates.shift()
    while (
      candidate &&
      ((candidate.sourceComponentId !== null &&
        this.findComponent(candidate.sourceComponentId) ===
          this.findComponent(candidate.targetComponentId)) ||
        !this.outputNetLabelPlacements.includes(candidate.sourceLabel))
    ) {
      candidate = this.queuedCandidates.shift()
    }
    if (!candidate) {
      this.solved = true
      return
    }

    this.currentCandidate = candidate
    let sourceRoutingPin = candidate.sourcePin
    if (candidate.sourceComponentId !== null) {
      sourceRoutingPin = {
        ...candidate.sourcePoint,
        pinId: `junction-source-${candidate.key}`,
        chipId: `junction-source-${candidate.key}`,
        _facingDirection: candidate.sourcePin._facingDirection,
      }
    }
    let targetRoutingPin = candidate.targetPin
    if (!pointsAreEqual(candidate.targetPoint, candidate.targetPin)) {
      targetRoutingPin = {
        ...candidate.targetPoint,
        pinId: `junction-target-${candidate.key}`,
        chipId: `junction-target-${candidate.key}`,
        _facingDirection: getAvailableJunctionDirection({
          trace: candidate.targetTrace,
          junctionPoint: candidate.targetPoint,
          sourcePoint: candidate.sourcePoint,
        }),
      }
    }
    this.activeSubSolver = new SchematicTraceSingleLineSolver2({
      inputProblem: this.inputProblem,
      pins: [sourceRoutingPin, targetRoutingPin],
      chipMap: this.chipMap,
    })
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      netLabelPlacements: this.outputNetLabelPlacements,
      inlineNetLabelPlacements: this.input.inlineNetLabelPlacements,
    }
  }

  override visualize(): GraphicsObject {
    if (this.activeSubSolver) return this.activeSubSolver.visualize()
    const graphics = visualizeInlineNetLabelOutput({
      inputProblem: this.inputProblem,
      ...this.getOutput(),
    })
    for (const trace of this.outputTraces) {
      if (!trace.mspPairId.startsWith(RECOVERED_TRACE_PREFIX)) continue
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "green",
        label: `recovered same-net junction: ${trace.pinIds.join(" -> ")}`,
      })
    }
    return graphics
  }
}
