import {
  doesSegmentIntersectRect,
  getBoundFromCenteredRect,
  type Point,
} from "@tscircuit/math-utils"
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
import { SchematicTraceSingleLineSolver2 } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import type {
  ChipId,
  InputChip,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import { arePinsInDifferentSchematicSections } from "lib/utils/arePinsInDifferentSchematicSections"
import { doesTraceOverlapWithExistingTraces } from "lib/utils/does-trace-overlap-with-existing-traces"
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
  perpendicularOffset: number
  routeDistance: number
  key: string
}

const AVAILABLE_NET_ORIENTATION_PREFIX = "available-net-orientation-"
const RECOVERED_TRACE_PREFIX = "net-label-to-trace-"
// Keep ordinary distant named-net endpoints as labels; only reconnect terminal
// labels that already read as one nearly straight rail in a multi-pin net.
const MAX_NAMED_NET_RECOVERY_PERPENDICULAR_OFFSET = 0.05

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

  private isPortOnlyFallbackLabel(
    label: NetLabelPlacement,
    groundGlobalConnNetId?: GlobalConnNetId,
  ) {
    return !(
      label.pinIds.length !== 1 ||
      label.mspConnectionPairIds.length !== 0 ||
      !label.netId ||
      label.netId === "GND" ||
      label.globalConnNetId === groundGlobalConnNetId
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
        connection.pinIds.length > 2 &&
        connection.netId === label.netId &&
        connection.pinIds.includes(pinId),
    )
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
        !this.isPortOnlyFallbackLabel(label, groundGlobalConnNetId) ||
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
          })
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
    if (
      doesTraceOverlapWithExistingTraces(tracePath, retainedTraces) ||
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
      pinIds: [firstPin.pinId, secondPin.pinId],
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
