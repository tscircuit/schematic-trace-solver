import {
  doSegmentsIntersect,
  doesSegmentIntersectRect,
  getBoundFromCenteredRect,
  type Point,
} from "@tscircuit/math-utils"
import { ConnectivityMap } from "connectivity-map"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { doesPairCrossRestrictedCenterLines } from "lib/solvers/MspConnectionPairSolver/doesPairCrossRestrictedCenterLines"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { doesTraceRecoveryPathConflict } from "lib/solvers/NetLabelTraceRecovery/doesTraceRecoveryPathConflict"
import {
  getTraceRecoveryConnectivityMaps,
  type TraceRecoveryPin,
} from "lib/solvers/NetLabelTraceRecovery/getTraceRecoveryConnectivityMaps"
import { getTraceConnectedPinComponents } from "lib/solvers/SchematicTraceLinesSolver/getTraceConnectedPinComponents"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { findFirstCollision } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { SchematicTraceSingleLineSolver2 } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import type {
  ChipId,
  InputChip,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import { arePinsInDifferentSchematicSections } from "lib/utils/arePinsInDifferentSchematicSections"
import {
  type InlineNetLabelOutput,
  type InlineNetLabelPlacement,
  visualizeInlineNetLabelOutput,
} from "../InlineNetLabelSolver/InlineNetLabelSolver"
import { reduceTraceCrossings } from "./reduceTraceCrossings"

type GlobalConnNetId = NetLabelPlacement["globalConnNetId"]

interface CandidatePair {
  firstLabel: NetLabelPlacement
  secondLabel: NetLabelPlacement
  pins: [TraceRecoveryPin, TraceRecoveryPin]
  perpendicularOffset: number
  routeDistance: number
  key: string
  recoveryMode:
    | "fallback_labels"
    | "routed_components"
    | "routed_direct_connection"
    | "routed_port_label"
    | "routed_direct_group"
  recoveryGroupPinIds?: PinId[]
}

const AVAILABLE_NET_ORIENTATION_PREFIX = "available-net-orientation-"
const RECOVERED_TRACE_PREFIX = "net-label-to-trace-"
const MAX_NAMED_NET_RECOVERY_PERPENDICULAR_OFFSET = 0.05
const MAX_ROUTED_COMPONENT_RECOVERY_PERPENDICULAR_OFFSET = 0.25
const MAX_TRACE_AWARE_RETRIES = 4
const DIRECT_GROUP_RECOVERY_COMPONENT_COUNT = 4
const MAX_CLEAR_TRACE_BRIDGE_DETOUR_RATIO = 2.5
const MAX_LOCAL_PORT_LABEL_DISTANCE = 5
const TRACE_RECOVERY_OBSTACLE_PADDING = 1e-4

const getCanonicalPairKey = (firstPinId: PinId, secondPinId: PinId) =>
  [firstPinId, secondPinId].sort().join("--")

const requiresClearTraceBridge = (candidate: CandidatePair) =>
  candidate.recoveryMode === "routed_direct_connection" ||
  candidate.recoveryMode === "routed_port_label" ||
  candidate.recoveryMode === "routed_direct_group"

const getRecoveryPhase = (candidate: CandidatePair) => {
  if (candidate.recoveryMode === "routed_port_label") return 1
  if (candidate.recoveryMode === "routed_direct_group") return 2
  return 0
}

const getRenderedLabelBounds = (
  label: NetLabelPlacement | InlineNetLabelPlacement,
) => {
  let width = label.width
  let height = label.height
  if ("axis" in label && label.axis === "y") {
    width = label.height
    height = label.width
  }
  return getBoundFromCenteredRect({
    center: label.center,
    width,
    height,
  })
}

export const pathIntersectsRenderedLabel = (
  path: Point[],
  label: NetLabelPlacement | InlineNetLabelPlacement,
) => {
  const bounds = getRenderedLabelBounds(label)
  for (let pathIndex = 0; pathIndex < path.length - 1; pathIndex++) {
    if (
      doesSegmentIntersectRect(path[pathIndex]!, path[pathIndex + 1]!, bounds)
    ) {
      return true
    }
  }
  return false
}

const getPerpendicularOffset = (firstPoint: Point, secondPoint: Point) => {
  const xDistance = Math.abs(firstPoint.x - secondPoint.x)
  const yDistance = Math.abs(firstPoint.y - secondPoint.y)
  if (xDistance >= yDistance) return yDistance
  return xDistance
}

const arePinsCoFacingAlongSeparationAxis = (
  firstPin: TraceRecoveryPin,
  secondPin: TraceRecoveryPin,
) => {
  if (firstPin._facingDirection !== secondPin._facingDirection) return false
  const xDistance = Math.abs(firstPin.x - secondPin.x)
  const yDistance = Math.abs(firstPin.y - secondPin.y)
  if (xDistance >= yDistance) {
    return (
      firstPin._facingDirection === "x+" || firstPin._facingDirection === "x-"
    )
  }
  return (
    firstPin._facingDirection === "y+" || firstPin._facingDirection === "y-"
  )
}

export class NetLabelToTraceSolver extends BaseSolver {
  inputProblem: InputProblem

  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]

  private chipMap: Record<ChipId, InputChip>
  private pinMap: Map<PinId, TraceRecoveryPin>
  private queuedCandidates: CandidatePair[]
  private currentCandidate: CandidatePair | null = null
  private recoveredDirectConnectionPinGroups = new Map<string, PinId[]>()
  private traceAwareRetryPaths = new Map<CandidatePair, Point[][]>()
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

    this.queuedCandidates = this.buildCandidatePairs()
    this.stats.candidateCount = this.queuedCandidates.length
    this.stats.recoveredTraceCount = 0
  }

  override getConstructorParams(): [InlineNetLabelOutput] {
    return [this.input]
  }

  private isPortOnlyFallbackLabel(
    label: NetLabelPlacement,
    groundGlobalConnNetIds: Set<GlobalConnNetId>,
  ) {
    return !(
      label.pinIds.length !== 1 ||
      label.mspConnectionPairIds.length !== 0 ||
      !label.netId ||
      groundGlobalConnNetIds.has(label.globalConnNetId)
    )
  }

  private isDirectConnectionLabel(label: NetLabelPlacement) {
    if (!label.netId || label.pinIds.length !== 1) return false
    const pinId = label.pinIds[0]!
    return this.inputProblem.directConnections.some(
      (connection) =>
        connection.netId === label.netId && connection.pinIds.includes(pinId),
    )
  }

  private getMultiPinNetConnection(label: NetLabelPlacement) {
    if (!label.netId || label.pinIds.length !== 1) return undefined
    const pinId = label.pinIds[0]!
    return this.inputProblem.netConnections.find(
      (connection) =>
        connection.isGround === false &&
        connection.pinIds.length > 2 &&
        connection.netId === label.netId &&
        connection.pinIds.includes(pinId),
    )
  }

  private buildCandidatePairs() {
    const { netConnMap } = getConnectivityMapsFromInputProblem(
      this.inputProblem,
    )
    const groundGlobalConnNetIds = new Set<GlobalConnNetId>()
    for (const connection of this.inputProblem.netConnections) {
      if (!connection.isGround) continue
      const globalConnNetId = netConnMap.getNetConnectedToId(connection.netId)
      if (globalConnNetId) groundGlobalConnNetIds.add(globalConnNetId)
    }
    const labelsByGlobalNet = new Map<GlobalConnNetId, NetLabelPlacement[]>()

    for (const label of this.input.netLabelPlacements) {
      if (
        !this.isPortOnlyFallbackLabel(label, groundGlobalConnNetIds) ||
        (!this.isDirectConnectionLabel(label) &&
          !this.getMultiPinNetConnection(label))
      ) {
        continue
      }
      const labels = labelsByGlobalNet.get(label.globalConnNetId) ?? []
      labels.push(label)
      labelsByGlobalNet.set(label.globalConnNetId, labels)
    }

    const candidates: CandidatePair[] = []
    for (const labels of labelsByGlobalNet.values()) {
      for (let firstIndex = 0; firstIndex < labels.length; firstIndex++) {
        for (
          let secondIndex = firstIndex + 1;
          secondIndex < labels.length;
          secondIndex++
        ) {
          const firstLabel = labels[firstIndex]!
          const secondLabel = labels[secondIndex]!
          const firstPin = this.pinMap.get(firstLabel.pinIds[0]!)
          const secondPin = this.pinMap.get(secondLabel.pinIds[0]!)
          if (!firstPin || !secondPin) continue
          const perpendicularOffset = getPerpendicularOffset(
            firstPin,
            secondPin,
          )
          const bothLabelsBelongToDirectConnections =
            this.isDirectConnectionLabel(firstLabel) &&
            this.isDirectConnectionLabel(secondLabel)
          const firstMultiPinNetConnection =
            this.getMultiPinNetConnection(firstLabel)
          const secondMultiPinNetConnection =
            this.getMultiPinNetConnection(secondLabel)
          if (
            !bothLabelsBelongToDirectConnections &&
            (!firstMultiPinNetConnection ||
              firstMultiPinNetConnection !== secondMultiPinNetConnection ||
              perpendicularOffset > MAX_NAMED_NET_RECOVERY_PERPENDICULAR_OFFSET)
          ) {
            continue
          }
          if (
            arePinsInDifferentSchematicSections(
              this.inputProblem,
              firstPin,
              secondPin,
            )
          ) {
            continue
          }
          if (
            doesPairCrossRestrictedCenterLines({
              inputProblem: this.inputProblem,
              chipMap: this.chipMap,
              pinIdMap: this.pinMap,
              p1: firstPin,
              p2: secondPin,
            })
          ) {
            continue
          }

          candidates.push({
            firstLabel,
            secondLabel,
            pins: [firstPin, secondPin],
            perpendicularOffset,
            routeDistance:
              Math.abs(firstPin.x - secondPin.x) +
              Math.abs(firstPin.y - secondPin.y),
            key: getCanonicalPairKey(firstPin.pinId, secondPin.pinId),
            recoveryMode: "fallback_labels",
          })
        }
      }
    }

    candidates.push(
      ...this.buildRoutedComponentCandidates(groundGlobalConnNetIds),
    )

    candidates.sort(
      (first, second) =>
        getRecoveryPhase(first) - getRecoveryPhase(second) ||
        first.perpendicularOffset - second.perpendicularOffset ||
        first.routeDistance - second.routeDistance ||
        first.key.localeCompare(second.key),
    )
    return candidates
  }

  private buildRoutedComponentCandidates(
    groundGlobalConnNetIds: Set<GlobalConnNetId>,
  ) {
    const { netConnMap } = getConnectivityMapsFromInputProblem(
      this.inputProblem,
    )
    const candidates: CandidatePair[] = []
    const connectionGroups: Array<{
      pinIds: PinId[]
      kind: "net_connection" | "direct_connection" | "direct_group"
    }> = this.inputProblem.netConnections
      .filter(
        (connection) =>
          connection.pinIds.length > 2 && connection.isGround === false,
      )
      .map((connection) => ({
        pinIds: connection.pinIds,
        kind: "net_connection" as const,
      }))
    connectionGroups.push(
      ...this.inputProblem.directConnections.map((connection) => ({
        pinIds: connection.pinIds,
        kind: "direct_connection" as const,
      })),
    )
    const seenDirectConnNetIds = new Set<string>()
    const physicalDirectConnMap = new ConnectivityMap({})
    // Only pin pairs establish physical adjacency. A repeated direct-connection
    // netId can describe separate islands and must not merge them here.
    for (const connection of this.inputProblem.directConnections) {
      physicalDirectConnMap.addConnections([connection.pinIds])
    }
    for (const connection of this.inputProblem.directConnections) {
      const directConnNetId = physicalDirectConnMap.getNetConnectedToId(
        connection.pinIds[0],
      )
      if (!directConnNetId || seenDirectConnNetIds.has(directConnNetId)) {
        continue
      }
      seenDirectConnNetIds.add(directConnNetId)
      const pinIds = (
        physicalDirectConnMap.getIdsConnectedToNet(directConnNetId) as string[]
      ).filter((id): id is PinId => this.pinMap.has(id as PinId))
      connectionGroups.push({
        pinIds,
        kind: "direct_group",
      })
    }

    for (const connection of connectionGroups) {
      const isDirectConnection = connection.kind !== "net_connection"
      const isDirectGroup = connection.kind === "direct_group"
      const globalConnNetId = netConnMap.getNetConnectedToId(
        connection.pinIds[0],
      )
      if (
        !globalConnNetId ||
        (isDirectConnection && groundGlobalConnNetIds.has(globalConnNetId))
      )
        continue
      // Anonymous endpoint pairs retain the exact-pair recovery above. Group
      // recovery is for physical pin graphs represented by named automatic nets.
      const hasNamedAutomaticNet = this.inputProblem.netConnections.some(
        (netConnection) =>
          netConnection.isGround !== false &&
          netConnMap.getNetConnectedToId(netConnection.netId) ===
            globalConnNetId,
      )
      if (isDirectGroup && !hasNamedAutomaticNet) {
        continue
      }
      let connectionPinIds = connection.pinIds
      if (connection.kind === "direct_connection") {
        connectionPinIds = [...this.pinMap.keys()].filter(
          (pinId) => netConnMap.getNetConnectedToId(pinId) === globalConnNetId,
        )
      }

      const traceConnectedPinComponents = getTraceConnectedPinComponents({
        pinIds: connectionPinIds,
        traces: this.outputTraces.filter(
          (trace) => trace.globalConnNetId === globalConnNetId,
        ),
      }).filter(
        (component) =>
          component.traces.length > 0 ||
          (connection.kind === "direct_connection" &&
            this.input.netLabelPlacements.some(
              (label) =>
                label.globalConnNetId === globalConnNetId &&
                label.pinIds.some((pinId) => component.pinIds.includes(pinId)),
            )),
      )
      if (
        isDirectGroup &&
        traceConnectedPinComponents.length !==
          DIRECT_GROUP_RECOVERY_COMPONENT_COUNT
      ) {
        continue
      }

      for (
        let firstIndex = 0;
        firstIndex < traceConnectedPinComponents.length;
        firstIndex++
      ) {
        for (
          let secondIndex = firstIndex + 1;
          secondIndex < traceConnectedPinComponents.length;
          secondIndex++
        ) {
          const firstComponent = traceConnectedPinComponents[firstIndex]!
          const secondComponent = traceConnectedPinComponents[secondIndex]!
          const isDirectPortLabelRecovery =
            connection.kind === "direct_connection" &&
            (firstComponent.traces.length === 0 ||
              secondComponent.traces.length === 0)
          const routedPortLabelComponent =
            firstComponent.traces.length === 0
              ? secondComponent
              : firstComponent
          if (
            isDirectPortLabelRecovery &&
            (traceConnectedPinComponents.length !== 2 ||
              routedPortLabelComponent.traces.length < 2)
          ) {
            continue
          }
          if (
            connection.kind === "direct_connection" &&
            !(
              (firstComponent.pinIds.includes(connection.pinIds[0]) &&
                secondComponent.pinIds.includes(connection.pinIds[1])) ||
              (firstComponent.pinIds.includes(connection.pinIds[1]) &&
                secondComponent.pinIds.includes(connection.pinIds[0]))
            )
          ) {
            continue
          }
          const firstLabel = this.input.netLabelPlacements.find(
            (label) =>
              label.globalConnNetId === globalConnNetId &&
              (label.mspConnectionPairIds.length > 0 ||
                connection.kind === "direct_connection") &&
              label.pinIds.some((pinId) =>
                firstComponent.pinIds.includes(pinId),
              ),
          )
          const secondLabel = this.input.netLabelPlacements.find(
            (label) =>
              label.globalConnNetId === globalConnNetId &&
              (label.mspConnectionPairIds.length > 0 ||
                connection.kind === "direct_connection") &&
              label.pinIds.some((pinId) =>
                secondComponent.pinIds.includes(pinId),
              ),
          )
          if (!firstLabel || !secondLabel || firstLabel === secondLabel)
            continue
          if (
            !isDirectGroup &&
            !isDirectPortLabelRecovery &&
            getPerpendicularOffset(
              firstLabel.anchorPoint,
              secondLabel.anchorPoint,
            ) > MAX_ROUTED_COMPONENT_RECOVERY_PERPENDICULAR_OFFSET
          ) {
            continue
          }

          const componentCandidates: CandidatePair[] = []
          let firstPinIds = firstComponent.pinIds
          let secondPinIds = secondComponent.pinIds
          if (connection.kind === "direct_connection") {
            firstPinIds = connection.pinIds.filter((pinId) =>
              firstComponent.pinIds.includes(pinId),
            )
            secondPinIds = connection.pinIds.filter((pinId) =>
              secondComponent.pinIds.includes(pinId),
            )
          }
          for (const firstPinId of firstPinIds) {
            for (const secondPinId of secondPinIds) {
              const firstPin = this.pinMap.get(firstPinId)
              const secondPin = this.pinMap.get(secondPinId)
              if (!firstPin || !secondPin) continue
              if (isDirectConnection && firstPin.chipId === secondPin.chipId)
                continue
              const perpendicularOffset = getPerpendicularOffset(
                firstPin,
                secondPin,
              )
              if (
                (!isDirectGroup &&
                  !isDirectPortLabelRecovery &&
                  (perpendicularOffset >
                    MAX_ROUTED_COMPONENT_RECOVERY_PERPENDICULAR_OFFSET ||
                    arePinsCoFacingAlongSeparationAxis(firstPin, secondPin))) ||
                arePinsInDifferentSchematicSections(
                  this.inputProblem,
                  firstPin,
                  secondPin,
                ) ||
                doesPairCrossRestrictedCenterLines({
                  inputProblem: this.inputProblem,
                  chipMap: this.chipMap,
                  pinIdMap: this.pinMap,
                  p1: firstPin,
                  p2: secondPin,
                })
              ) {
                continue
              }

              const routeDistance =
                Math.abs(firstPin.x - secondPin.x) +
                Math.abs(firstPin.y - secondPin.y)
              if (
                isDirectPortLabelRecovery &&
                routeDistance > MAX_LOCAL_PORT_LABEL_DISTANCE
              ) {
                continue
              }
              let recoveryMode: CandidatePair["recoveryMode"] =
                "routed_components"
              if (isDirectPortLabelRecovery) {
                recoveryMode = "routed_port_label"
              } else if (isDirectConnection) {
                recoveryMode = "routed_direct_connection"
              }
              if (isDirectGroup) recoveryMode = "routed_direct_group"
              const candidate: CandidatePair = {
                firstLabel,
                secondLabel,
                pins: [firstPin, secondPin],
                perpendicularOffset,
                routeDistance,
                key: getCanonicalPairKey(firstPin.pinId, secondPin.pinId),
                recoveryMode,
                recoveryGroupPinIds: connectionPinIds,
              }
              componentCandidates.push(candidate)
            }
          }
          componentCandidates.sort(
            (first, second) =>
              first.routeDistance - second.routeDistance ||
              first.perpendicularOffset - second.perpendicularOffset ||
              first.key.localeCompare(second.key),
          )
          candidates.push(
            ...componentCandidates.slice(0, isDirectGroup ? 3 : 1),
          )
        }
      }
    }

    return candidates
  }

  private isSupersededConnectorTrace(
    trace: SolvedTracePath,
    candidate: CandidatePair,
  ) {
    if (!trace.mspPairId.startsWith(AVAILABLE_NET_ORIENTATION_PREFIX)) {
      return false
    }
    if (trace.pinIds.length !== 1) return false
    return candidate.pins.some((pin) => pin.pinId === trace.pinIds[0])
  }

  private routeIntersectsRemainingLabels(
    tracePath: Point[],
    candidate: CandidatePair,
  ) {
    for (const label of this.outputNetLabelPlacements) {
      if (label === candidate.firstLabel || label === candidate.secondLabel) {
        continue
      }
      if (pathIntersectsRenderedLabel(tracePath, label)) return true
    }
    return this.input.inlineNetLabelPlacements.some((label) =>
      pathIntersectsRenderedLabel(tracePath, label),
    )
  }

  private routeCrossesNonEndpointTrace(
    tracePath: Point[],
    candidate: CandidatePair,
    traces: SolvedTracePath[],
  ) {
    for (const trace of traces) {
      // Traces incident to either endpoint are the intended connection targets
      // and may share their existing port escape with the recovered path.
      if (
        trace.pinIds.some((pinId) =>
          candidate.pins.some((pin) => pin.pinId === pinId),
        )
      ) {
        continue
      }
      for (let pathIndex = 0; pathIndex < tracePath.length - 1; pathIndex++) {
        for (
          let traceIndex = 0;
          traceIndex < trace.tracePath.length - 1;
          traceIndex++
        ) {
          if (
            doSegmentsIntersect(
              tracePath[pathIndex]!,
              tracePath[pathIndex + 1]!,
              trace.tracePath[traceIndex]!,
              trace.tracePath[traceIndex + 1]!,
            )
          ) {
            return true
          }
        }
      }
    }
    return false
  }

  private addClearTraceRecoveryObstacles(
    candidate: CandidatePair,
    routeSolver: SchematicTraceSingleLineSolver2,
    blockedPaths: Point[][],
  ) {
    const endpointPinIds = new Set(candidate.pins.map((pin) => pin.pinId))
    for (const trace of this.outputTraces) {
      if (trace.pinIds.some((pinId) => endpointPinIds.has(pinId))) continue
      for (
        let traceIndex = 0;
        traceIndex < trace.tracePath.length - 1;
        traceIndex++
      ) {
        const start = trace.tracePath[traceIndex]!
        const end = trace.tracePath[traceIndex + 1]!
        const blocksAttemptedPath = blockedPaths.some((blockedPath) =>
          blockedPath
            .slice(1)
            .some((pathEnd, pathIndex) =>
              doSegmentsIntersect(blockedPath[pathIndex]!, pathEnd, start, end),
            ),
        )
        if (!blocksAttemptedPath) continue
        routeSolver.obstacles.push({
          kind: "chip",
          chipId: `trace-recovery-obstacle-${trace.mspPairId}-${traceIndex}`,
          minX: Math.min(start.x, end.x) - TRACE_RECOVERY_OBSTACLE_PADDING,
          maxX: Math.max(start.x, end.x) + TRACE_RECOVERY_OBSTACLE_PADDING,
          minY: Math.min(start.y, end.y) - TRACE_RECOVERY_OBSTACLE_PADDING,
          maxY: Math.max(start.y, end.y) + TRACE_RECOVERY_OBSTACLE_PADDING,
        })
      }
    }

    const remainingLabels = [
      ...this.outputNetLabelPlacements.filter(
        (label) =>
          label !== candidate.firstLabel && label !== candidate.secondLabel,
      ),
      ...this.input.inlineNetLabelPlacements,
    ]
    for (const [labelIndex, label] of remainingLabels.entries()) {
      if (
        !blockedPaths.some((blockedPath) =>
          pathIntersectsRenderedLabel(blockedPath, label),
        )
      )
        continue
      routeSolver.obstacles.push({
        kind: "chip",
        chipId: `trace-recovery-label-obstacle-${labelIndex}`,
        ...getRenderedLabelBounds(label),
      })
    }
  }

  private currentRouteNeedsTraceAwareRetry(candidate: CandidatePair) {
    const tracePath = this.activeSubSolver?.solvedTracePath
    if (!tracePath || !requiresClearTraceBridge(candidate)) return false
    const retainedTraces = this.outputTraces.filter(
      (trace) => !this.isSupersededConnectorTrace(trace, candidate),
    )
    return (
      this.routeCrossesNonEndpointTrace(tracePath, candidate, retainedTraces) ||
      this.routeIntersectsRemainingLabels(tracePath, candidate)
    )
  }

  private isClearTraceBridgeTooIndirect(
    tracePath: Point[],
    candidate: CandidatePair,
  ) {
    if (
      candidate.recoveryMode !== "routed_port_label" &&
      candidate.recoveryMode !== "routed_direct_group"
    ) {
      return false
    }
    const pathDistance = tracePath.slice(1).reduce((distance, point, index) => {
      const previousPoint = tracePath[index]!
      return (
        distance +
        Math.abs(point.x - previousPoint.x) +
        Math.abs(point.y - previousPoint.y)
      )
    }, 0)
    return (
      pathDistance / candidate.routeDistance >
      MAX_CLEAR_TRACE_BRIDGE_DETOUR_RATIO
    )
  }

  private createRouteSolver(
    candidate: CandidatePair,
    recoveryObstaclePaths?: Point[][],
  ) {
    const routeSolver = new SchematicTraceSingleLineSolver2({
      inputProblem: this.inputProblem,
      pins: candidate.pins,
      chipMap: this.chipMap,
      connectionPair:
        candidate.recoveryMode === "routed_direct_group"
          ? {
              mspPairId: `${RECOVERED_TRACE_PREFIX}${candidate.key}`,
              dcConnNetId: candidate.firstLabel.globalConnNetId,
              globalConnNetId: candidate.firstLabel.globalConnNetId,
              userNetId: candidate.firstLabel.netId,
              pins: candidate.pins,
            }
          : undefined,
    })
    if (recoveryObstaclePaths) {
      this.addClearTraceRecoveryObstacles(
        candidate,
        routeSolver,
        recoveryObstaclePaths,
      )
    }
    return routeSolver
  }

  private tryAcceptCurrentRoute() {
    const candidate = this.currentCandidate
    let tracePath = this.activeSubSolver?.solvedTracePath
    if (!candidate || !tracePath) return

    const retainedTraces = this.outputTraces.filter(
      (trace) => !this.isSupersededConnectorTrace(trace, candidate),
    )
    let collisionTraces = retainedTraces
    if (candidate.recoveryMode !== "fallback_labels") {
      collisionTraces = retainedTraces.filter(
        (trace) =>
          trace.globalConnNetId !== candidate.firstLabel.globalConnNetId,
      )
    }
    if (
      doesTraceRecoveryPathConflict(tracePath, collisionTraces) ||
      this.isClearTraceBridgeTooIndirect(tracePath, candidate) ||
      (requiresClearTraceBridge(candidate) &&
        this.routeCrossesNonEndpointTrace(
          tracePath,
          candidate,
          retainedTraces,
        )) ||
      this.routeIntersectsRemainingLabels(tracePath, candidate)
    ) {
      return
    }

    tracePath = reduceTraceCrossings({
      tracePath,
      globalConnNetId: candidate.firstLabel.globalConnNetId,
      otherTraces: collisionTraces,
      isCandidateValid: (candidatePath) =>
        findFirstCollision(candidatePath, this.activeSubSolver!.obstacles) ===
          null &&
        !doesTraceRecoveryPathConflict(candidatePath, collisionTraces) &&
        (!requiresClearTraceBridge(candidate) ||
          !this.routeCrossesNonEndpointTrace(
            candidatePath,
            candidate,
            retainedTraces,
          )) &&
        !this.routeIntersectsRemainingLabels(candidatePath, candidate),
    })

    const [firstPin, secondPin] = candidate.pins
    const mspPairId = `${RECOVERED_TRACE_PREFIX}${candidate.key}`
    const recoveredTrace: SolvedTracePath = {
      mspPairId,
      dcConnNetId: candidate.firstLabel.globalConnNetId,
      globalConnNetId: candidate.firstLabel.globalConnNetId,
      pins: [firstPin, secondPin],
      tracePath,
      mspConnectionPairIds: [mspPairId],
      pinIds: [firstPin.pinId, secondPin.pinId],
    }

    this.outputTraces = [...retainedTraces, recoveredTrace]
    if (
      candidate.recoveryMode === "fallback_labels" ||
      candidate.recoveryMode === "routed_direct_connection" ||
      candidate.recoveryMode === "routed_port_label"
    ) {
      this.outputNetLabelPlacements = this.outputNetLabelPlacements.filter(
        (label) =>
          label !== candidate.firstLabel && label !== candidate.secondLabel,
      )
    }
    if (candidate.recoveryMode === "routed_direct_group") {
      const pinIds = candidate.recoveryGroupPinIds ?? []
      this.recoveredDirectConnectionPinGroups.set(
        [...pinIds].sort().join("--"),
        pinIds,
      )
    }
    this.stats.recoveredTraceCount++
  }

  private consolidateRecoveredDirectConnectionLabels() {
    const { netConnMap } = getConnectivityMapsFromInputProblem(
      this.inputProblem,
    )
    const namedNetIds = new Set(
      this.inputProblem.netConnections.map((connection) => connection.netId),
    )
    const labelsToRemove = new Set<NetLabelPlacement>()
    const labelsToKeep = new Set<NetLabelPlacement>()

    for (const pinIds of this.recoveredDirectConnectionPinGroups.values()) {
      const globalConnNetId = netConnMap.getNetConnectedToId(pinIds[0])
      if (!globalConnNetId) continue
      const labels = this.outputNetLabelPlacements.filter(
        (label) =>
          label.globalConnNetId === globalConnNetId &&
          label.pinIds.some((pinId) => pinIds.includes(pinId)),
      )
      const components = getTraceConnectedPinComponents({
        pinIds,
        traces: this.outputTraces.filter(
          (trace) => trace.globalConnNetId === globalConnNetId,
        ),
      })

      for (const component of components) {
        const componentLabels = labels.filter((label) =>
          label.pinIds.some((pinId) => component.pinIds.includes(pinId)),
        )
        for (const label of componentLabels) labelsToRemove.add(label)

        const namedLabel = componentLabels.find(
          (candidate) =>
            candidate.netId !== undefined && namedNetIds.has(candidate.netId),
        )
        if (namedLabel) {
          labelsToKeep.add(namedLabel)
        } else if (components.length > 1 && componentLabels[0]) {
          labelsToKeep.add(componentLabels[0])
        }
      }
    }

    this.outputNetLabelPlacements = this.outputNetLabelPlacements.filter(
      (label) => !labelsToRemove.has(label) || labelsToKeep.has(label),
    )
  }

  private areCandidatePinsAlreadyConnected(candidate: CandidatePair) {
    if (!candidate.recoveryGroupPinIds) return false
    return getTraceConnectedPinComponents({
      pinIds: candidate.recoveryGroupPinIds,
      traces: this.outputTraces,
    }).some(
      (component) =>
        component.pinIds.includes(candidate.pins[0].pinId) &&
        component.pinIds.includes(candidate.pins[1].pinId),
    )
  }

  override _step() {
    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      if (this.activeSubSolver.solved) {
        if (
          this.currentCandidate &&
          this.currentRouteNeedsTraceAwareRetry(this.currentCandidate)
        ) {
          const retryPaths =
            this.traceAwareRetryPaths.get(this.currentCandidate) ?? []
          if (retryPaths.length < MAX_TRACE_AWARE_RETRIES) {
            retryPaths.push(this.activeSubSolver.solvedTracePath!)
            this.traceAwareRetryPaths.set(this.currentCandidate, retryPaths)
            this.activeSubSolver = this.createRouteSolver(
              this.currentCandidate,
              retryPaths,
            )
            return
          }
        }
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
      (!this.outputNetLabelPlacements.includes(candidate.firstLabel) ||
        !this.outputNetLabelPlacements.includes(candidate.secondLabel) ||
        this.areCandidatePinsAlreadyConnected(candidate))
    ) {
      candidate = this.queuedCandidates.shift()
    }

    if (!candidate) {
      this.consolidateRecoveredDirectConnectionLabels()
      this.solved = true
      return
    }

    this.currentCandidate = candidate
    this.activeSubSolver = this.createRouteSolver(candidate)
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
        label: `recovered from net labels: ${trace.pinIds.join(" -> ")}`,
      })
    }
    return graphics
  }
}
