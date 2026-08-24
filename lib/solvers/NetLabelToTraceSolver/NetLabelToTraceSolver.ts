import { doSegmentsIntersect, type Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { doesPairCrossRestrictedCenterLines } from "lib/solvers/MspConnectionPairSolver/doesPairCrossRestrictedCenterLines"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getPinDirection } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import { SchematicTraceSingleLineSolver2 } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import type { InputChip, InputPin, InputProblem } from "lib/types/InputProblem"
import { arePinsInDifferentSchematicSections } from "lib/utils/arePinsInDifferentSchematicSections"
import { doesTraceOverlapWithExistingTraces } from "lib/utils/does-trace-overlap-with-existing-traces"
import type { FacingDirection } from "lib/utils/dir"
import {
  type InlineNetLabelPlacement,
  visualizeInlineNetLabelOutput,
} from "../InlineNetLabelSolver/InlineNetLabelSolver"

type PinWithChipId = InputPin & {
  chipId: string
  _facingDirection: FacingDirection
}

interface CandidatePair {
  firstLabel: NetLabelPlacement
  secondLabel: NetLabelPlacement
  pins: [PinWithChipId, PinWithChipId]
  perpendicularOffset: number
  routeDistance: number
  key: string
}

export interface NetLabelToTraceSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  inlineNetLabelPlacements: InlineNetLabelPlacement[]
}

const AVAILABLE_NET_ORIENTATION_PREFIX = "available-net-orientation-"
const COLLISION_EPSILON = 1e-9

const getCanonicalPairKey = (firstPinId: string, secondPinId: string) =>
  [firstPinId, secondPinId].sort().join("--")

const getRenderedLabelBounds = (label: {
  center: Point
  width: number
  height: number
  axis?: "x" | "y"
}) => {
  const width = label.axis === "y" ? label.height : label.width
  const height = label.axis === "y" ? label.width : label.height
  return {
    minX: label.center.x - width / 2,
    maxX: label.center.x + width / 2,
    minY: label.center.y - height / 2,
    maxY: label.center.y + height / 2,
  }
}

const segmentIntersectsBounds = (
  start: Point,
  end: Point,
  bounds: ReturnType<typeof getRenderedLabelBounds>,
) => {
  const pointIsInside = (point: Point) =>
    point.x >= bounds.minX - COLLISION_EPSILON &&
    point.x <= bounds.maxX + COLLISION_EPSILON &&
    point.y >= bounds.minY - COLLISION_EPSILON &&
    point.y <= bounds.maxY + COLLISION_EPSILON

  if (pointIsInside(start) || pointIsInside(end)) return true

  const topLeft = { x: bounds.minX, y: bounds.maxY }
  const topRight = { x: bounds.maxX, y: bounds.maxY }
  const bottomRight = { x: bounds.maxX, y: bounds.minY }
  const bottomLeft = { x: bounds.minX, y: bounds.minY }
  return [
    [topLeft, topRight],
    [topRight, bottomRight],
    [bottomRight, bottomLeft],
    [bottomLeft, topLeft],
  ].some(([edgeStart, edgeEnd]) =>
    doSegmentsIntersect(start, end, edgeStart!, edgeEnd!),
  )
}

export const pathIntersectsRenderedLabel = (
  path: Point[],
  label: Parameters<typeof getRenderedLabelBounds>[0],
) => {
  const bounds = getRenderedLabelBounds(label)
  for (let pathIndex = 0; pathIndex < path.length - 1; pathIndex++) {
    if (
      segmentIntersectsBounds(path[pathIndex]!, path[pathIndex + 1]!, bounds)
    ) {
      return true
    }
  }
  return false
}

const getPerpendicularOffset = (
  firstPin: PinWithChipId,
  secondPin: PinWithChipId,
) => {
  const xDistance = Math.abs(firstPin.x - secondPin.x)
  const yDistance = Math.abs(firstPin.y - secondPin.y)
  return xDistance >= yDistance ? yDistance : xDistance
}

export class NetLabelToTraceSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  inputNetLabelPlacements: NetLabelPlacement[]
  inlineNetLabelPlacements: InlineNetLabelPlacement[]

  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  recoveredTraces: SolvedTracePath[] = []

  private chipMap: Record<string, InputChip> = {}
  private pinMap = new Map<string, PinWithChipId>()
  private queuedCandidates: CandidatePair[]
  private usedPinIds = new Set<string>()
  private currentCandidate: CandidatePair | null = null
  declare activeSubSolver: SchematicTraceSingleLineSolver2 | null

  constructor(private input: NetLabelToTraceSolverInput) {
    super()
    this.inputProblem = input.inputProblem
    this.inputTraces = input.traces
    this.inputNetLabelPlacements = input.netLabelPlacements
    this.inlineNetLabelPlacements = input.inlineNetLabelPlacements
    this.outputTraces = [...input.traces]
    this.outputNetLabelPlacements = [...input.netLabelPlacements]

    for (const chip of this.inputProblem.chips) {
      this.chipMap[chip.chipId] = chip
      for (const pin of chip.pins) {
        this.pinMap.set(pin.pinId, {
          ...pin,
          chipId: chip.chipId,
          _facingDirection: pin._facingDirection ?? getPinDirection(pin, chip),
        })
      }
    }

    this.queuedCandidates = this.buildCandidatePairs()
    this.stats.candidateCount = this.queuedCandidates.length
    this.stats.recoveredTraceCount = 0
  }

  override getConstructorParams(): [NetLabelToTraceSolverInput] {
    return [this.input]
  }

  private isEligiblePortOnlyDirectConnectionLabel(
    label: NetLabelPlacement,
    groundGlobalConnNetId?: string,
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

  private buildCandidatePairs() {
    const { netConnMap } = getConnectivityMapsFromInputProblem(
      this.inputProblem,
    )
    const groundGlobalConnNetId =
      netConnMap.getNetConnectedToId("GND") ?? undefined
    const labelsByGlobalNet = new Map<string, NetLabelPlacement[]>()

    for (const label of this.inputNetLabelPlacements) {
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
    const pinIdMap = this.pinMap as Map<string, InputPin & { chipId: string }>
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
              pinIdMap,
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
    return this.inlineNetLabelPlacements.some((label) =>
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
    const mspPairId = `net-label-to-trace-${candidate.key}`
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
    this.recoveredTraces.push(recoveredTrace)
    this.usedPinIds.add(firstPin.pinId)
    this.usedPinIds.add(secondPin.pinId)
    this.stats.recoveredTraceCount = this.recoveredTraces.length
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
      candidate.pins.some((pin) => this.usedPinIds.has(pin.pinId))
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
      inlineNetLabelPlacements: this.inlineNetLabelPlacements,
    }
  }

  override visualize(): GraphicsObject {
    if (this.activeSubSolver) return this.activeSubSolver.visualize()

    const graphics = visualizeInlineNetLabelOutput({
      inputProblem: this.inputProblem,
      ...this.getOutput(),
    })
    for (const trace of this.recoveredTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "green",
        label: `recovered from net labels: ${trace.pinIds.join(" -> ")}`,
      })
    }
    return graphics
  }
}
