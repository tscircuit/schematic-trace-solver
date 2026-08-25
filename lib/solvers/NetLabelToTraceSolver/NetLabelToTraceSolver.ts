import {
  doesSegmentIntersectRect,
  getBoundFromCenteredRect,
  type Point,
} from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { DEFAULT_MAX_MSP_PAIR_DISTANCE } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { doesPairCrossRestrictedCenterLines } from "lib/solvers/MspConnectionPairSolver/doesPairCrossRestrictedCenterLines"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  getTraceRecoveryConnectivityMaps,
  type TraceRecoveryPin,
} from "lib/solvers/NetLabelTraceRecovery/getTraceRecoveryConnectivityMaps"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SchematicTraceSingleLineSolver2 } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import type {
  ChipId,
  InputChip,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import { arePinsInDifferentSchematicSections } from "lib/utils/arePinsInDifferentSchematicSections"
import { doesTraceOverlapWithExistingTraces } from "lib/utils/does-trace-overlap-with-existing-traces"
import { tracePathContainsPoint } from "../RailNetLabelCornerPlacementSolver/geometry"
import {
  type InlineNetLabelPlacement,
  type InlineNetLabelOutput,
  visualizeInlineNetLabelOutput,
} from "../InlineNetLabelSolver/InlineNetLabelSolver"

type GlobalConnNetId = NetLabelPlacement["globalConnNetId"]

interface CandidatePair {
  firstLabel: NetLabelPlacement
  secondLabel: NetLabelPlacement
  pins: [TraceRecoveryPin, TraceRecoveryPin]
  connectsToExistingTrace?: boolean
  outputPinIds?: PinId[]
  perpendicularOffset: number
  routeDistance: number
  key: string
}

const AVAILABLE_NET_ORIENTATION_PREFIX = "available-net-orientation-"
const RECOVERED_TRACE_PREFIX = "net-label-to-trace-"

const getCanonicalPairKey = (firstPinId: PinId, secondPinId: PinId) =>
  [firstPinId, secondPinId].sort().join("--")

export const pathIntersectsRenderedLabel = (
  path: Point[],
  label: NetLabelPlacement | InlineNetLabelPlacement,
) => {
  let width = label.width
  let height = label.height
  if ("axis" in label && label.axis === "y") {
    width = label.height
    height = label.width
  }
  const bounds = getBoundFromCenteredRect({
    center: label.center,
    width,
    height,
  })
  for (let pathIndex = 0; pathIndex < path.length - 1; pathIndex++) {
    if (
      doesSegmentIntersectRect(path[pathIndex]!, path[pathIndex + 1]!, bounds)
    ) {
      return true
    }
  }
  return false
}

const getPerpendicularOffset = (
  firstPin: TraceRecoveryPin,
  secondPin: TraceRecoveryPin,
) => {
  const xDistance = Math.abs(firstPin.x - secondPin.x)
  const yDistance = Math.abs(firstPin.y - secondPin.y)
  if (xDistance >= yDistance) return yDistance
  return xDistance
}

const getFacingDirectionForTraceAnchor = ({
  portPin,
  anchorPoint,
  hostSegmentStart,
  hostSegmentEnd,
}: {
  portPin: TraceRecoveryPin
  anchorPoint: Point
  hostSegmentStart: Point
  hostSegmentEnd: Point
}): TraceRecoveryPin["_facingDirection"] => {
  if (hostSegmentStart.y === hostSegmentEnd.y) {
    if (portPin.y < anchorPoint.y) return "y-"
    return "y+"
  }
  if (portPin.x < anchorPoint.x) return "x-"
  return "x+"
}

export class NetLabelToTraceSolver extends BaseSolver {
  inputProblem: InputProblem

  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]

  private chipMap: Record<ChipId, InputChip>
  private pinMap: Map<PinId, TraceRecoveryPin>
  private queuedCandidates: CandidatePair[]
  private currentCandidate: CandidatePair | null = null
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

  private isEligiblePortOnlyDirectConnectionLabel(
    label: NetLabelPlacement,
    groundGlobalConnNetId?: GlobalConnNetId,
  ) {
    if (
      label.pinIds.length !== 1 ||
      label.mspConnectionPairIds.length !== 0 ||
      !label.netId ||
      label.netId === "GND" ||
      label.globalConnNetId === groundGlobalConnNetId
    ) {
      return false
    }

    const pinId = label.pinIds[0]!
    return this.inputProblem.directConnections.some(
      (connection) =>
        connection.netId === label.netId && connection.pinIds.includes(pinId),
    )
  }

  private buildAnchoredTraceCandidate(
    portLabel: NetLabelPlacement,
    anchoredLabel: NetLabelPlacement,
  ): CandidatePair | undefined {
    const portPin = this.pinMap.get(portLabel.pinIds[0]!)
    if (!portPin) return
    if (anchoredLabel.globalConnNetId !== portLabel.globalConnNetId) return
    if (anchoredLabel.netId !== portLabel.netId) return

    const directNeighborPinIds = new Set(
      this.inputProblem.directConnections
        .filter((connection) => connection.pinIds.includes(portPin.pinId))
        .flatMap((connection) => connection.pinIds)
        .filter((pinId) => pinId !== portPin.pinId),
    )
    if (anchoredLabel.pinIds.length < 2) return
    if (
      !anchoredLabel.pinIds.every((pinId) => directNeighborPinIds.has(pinId))
    ) {
      return
    }

    const hostTrace = this.outputTraces.find(
      (trace) =>
        anchoredLabel.mspConnectionPairIds.some(
          (pairId) =>
            trace.mspPairId === pairId ||
            trace.mspConnectionPairIds.includes(pairId),
        ) && tracePathContainsPoint(trace.tracePath, anchoredLabel.anchorPoint),
    )
    if (!hostTrace) return

    let hostSegmentStart: Point | undefined
    let hostSegmentEnd: Point | undefined
    for (let index = 0; index < hostTrace.tracePath.length - 1; index++) {
      const segmentStart = hostTrace.tracePath[index]!
      const segmentEnd = hostTrace.tracePath[index + 1]!
      if (
        !tracePathContainsPoint(
          [segmentStart, segmentEnd],
          anchoredLabel.anchorPoint,
        )
      ) {
        continue
      }
      hostSegmentStart = segmentStart
      hostSegmentEnd = segmentEnd
      break
    }
    if (!hostSegmentStart || !hostSegmentEnd) return

    const facingDirection = getFacingDirectionForTraceAnchor({
      portPin,
      anchorPoint: anchoredLabel.anchorPoint,
      hostSegmentStart,
      hostSegmentEnd,
    })
    const anchorPinId = `${RECOVERED_TRACE_PREFIX}anchor-${anchoredLabel.mspConnectionPairIds.join("--")}`
    const anchorChipId = `${anchorPinId}-chip`
    const anchorPin: TraceRecoveryPin = {
      pinId: anchorPinId,
      chipId: anchorChipId,
      ...anchoredLabel.anchorPoint,
      _facingDirection: facingDirection,
    }
    const maxAxisDistance = Math.max(
      Math.abs(portPin.x - anchorPin.x),
      Math.abs(portPin.y - anchorPin.y),
    )
    let maxMspPairDistance = this.inputProblem.maxMspPairDistance
    if (maxMspPairDistance === undefined) {
      maxMspPairDistance = DEFAULT_MAX_MSP_PAIR_DISTANCE
    }
    if (maxAxisDistance > maxMspPairDistance) return

    this.chipMap[anchorChipId] = {
      chipId: anchorChipId,
      center: anchoredLabel.anchorPoint,
      width: 0,
      height: 0,
      pins: [anchorPin],
    }

    return {
      firstLabel: portLabel,
      secondLabel: anchoredLabel,
      pins: [portPin, anchorPin],
      connectsToExistingTrace: true,
      outputPinIds: [...portLabel.pinIds, ...anchoredLabel.pinIds],
      perpendicularOffset: getPerpendicularOffset(portPin, anchorPin),
      routeDistance:
        Math.abs(portPin.x - anchorPin.x) + Math.abs(portPin.y - anchorPin.y),
      key: getCanonicalPairKey(portPin.pinId, anchorPin.pinId),
    }
  }

  private buildCandidatePairs() {
    const { netConnMap } = getConnectivityMapsFromInputProblem(
      this.inputProblem,
    )
    const groundGlobalConnNetId =
      netConnMap.getNetConnectedToId("GND") ?? undefined
    const labelsByGlobalNet = new Map<GlobalConnNetId, NetLabelPlacement[]>()

    for (const label of this.input.netLabelPlacements) {
      if (
        !this.isEligiblePortOnlyDirectConnectionLabel(
          label,
          groundGlobalConnNetId,
        )
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
            perpendicularOffset: getPerpendicularOffset(firstPin, secondPin),
            routeDistance:
              Math.abs(firstPin.x - secondPin.x) +
              Math.abs(firstPin.y - secondPin.y),
            key: getCanonicalPairKey(firstPin.pinId, secondPin.pinId),
          })
        }
      }
    }

    const anchoredLabels = this.input.netLabelPlacements.filter(
      (label) => label.mspConnectionPairIds.length > 0,
    )

    for (const portLabels of labelsByGlobalNet.values()) {
      for (const portLabel of portLabels) {
        for (const anchoredLabel of anchoredLabels) {
          const candidate = this.buildAnchoredTraceCandidate(
            portLabel,
            anchoredLabel,
          )
          if (!candidate) continue
          candidates.push(candidate)
        }
      }
    }

    candidates.sort(
      (first, second) =>
        first.perpendicularOffset - second.perpendicularOffset ||
        first.routeDistance - second.routeDistance ||
        first.key.localeCompare(second.key),
    )
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

  private tryAcceptCurrentRoute() {
    const candidate = this.currentCandidate
    const tracePath = this.activeSubSolver?.solvedTracePath
    if (!candidate || !tracePath) return

    const retainedTraces = this.outputTraces.filter(
      (trace) => !this.isSupersededConnectorTrace(trace, candidate),
    )
    let collisionTraces = retainedTraces
    if (candidate.connectsToExistingTrace) {
      collisionTraces = retainedTraces.filter(
        (trace) =>
          trace.globalConnNetId !== candidate.firstLabel.globalConnNetId,
      )
    }
    if (
      doesTraceOverlapWithExistingTraces(tracePath, collisionTraces) ||
      this.routeIntersectsRemainingLabels(tracePath, candidate)
    ) {
      return
    }

    const [firstPin, secondPin] = candidate.pins
    const mspPairId = `${RECOVERED_TRACE_PREFIX}${candidate.key}`
    const recoveredTrace: SolvedTracePath = {
      mspPairId,
      dcConnNetId: candidate.firstLabel.globalConnNetId,
      globalConnNetId: candidate.firstLabel.globalConnNetId,
      pins: [firstPin, secondPin],
      tracePath,
      mspConnectionPairIds: [mspPairId],
      pinIds: candidate.outputPinIds ?? [firstPin.pinId, secondPin.pinId],
    }

    this.outputTraces = [...retainedTraces, recoveredTrace]
    this.outputNetLabelPlacements = this.outputNetLabelPlacements.filter(
      (label) =>
        label !== candidate.firstLabel && label !== candidate.secondLabel,
    )
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
      (!this.outputNetLabelPlacements.includes(candidate.firstLabel) ||
        !this.outputNetLabelPlacements.includes(candidate.secondLabel))
    ) {
      candidate = this.queuedCandidates.shift()
    }

    if (!candidate) {
      this.solved = true
      return
    }

    this.currentCandidate = candidate
    this.activeSubSolver = new SchematicTraceSingleLineSolver2({
      inputProblem: this.inputProblem,
      pins: candidate.pins,
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
        label: `recovered from net labels: ${trace.pinIds.join(" -> ")}`,
      })
    }
    return graphics
  }
}
