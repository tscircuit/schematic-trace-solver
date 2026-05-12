import type { GraphicsObject } from "graphics-debug"
import { traceCrossesBoundsInterior } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  getCenterFromAnchor,
  getRectBounds,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import {
  getDistance,
  getTraceCorners,
  isTraceLine,
  rectsOverlap,
  tracePathContainsPoint,
} from "./geometry"
import type {
  Bounds,
  CornerCandidateStatus,
  EvaluatedCornerCandidate,
  TraceCornerCandidate,
  VccNetLabelCornerPlacementSolverParams,
} from "./types"
import { visualizeVccNetLabelCornerPlacementSolver } from "./visualize"

export class VccNetLabelCornerPlacementSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]

  outputNetLabelPlacements: NetLabelPlacement[]
  queuedLabelIndices: number[] = []
  currentLabelIndex: number | null = null
  currentLabel: NetLabelPlacement | null = null
  currentCandidateResults: EvaluatedCornerCandidate[] = []

  private queuedCornerCandidates: TraceCornerCandidate[] = []
  private shouldAdvanceToNextLabel = false
  private traceMap: Record<string, SolvedTracePath>

  constructor(params: VccNetLabelCornerPlacementSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.traces = params.traces
    this.netLabelPlacements = params.netLabelPlacements
    this.outputNetLabelPlacements = [...params.netLabelPlacements]
    this.traceMap = Object.fromEntries(
      params.traces.map((trace) => [trace.mspPairId, trace]),
    )
    this.queuedLabelIndices = this.getProcessableLabelIndices()
    this.prepareNextLabel()
  }

  override getConstructorParams(): ConstructorParameters<
    typeof VccNetLabelCornerPlacementSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.traces,
      netLabelPlacements: this.netLabelPlacements,
    }
  }

  override _step() {
    if (this.shouldAdvanceToNextLabel) {
      this.advanceToNextLabel()
      return
    }

    const label = this.currentLabel
    const labelIndex = this.currentLabelIndex
    if (label === null || labelIndex === null) {
      this.finish()
      return
    }

    const candidate = this.queuedCornerCandidates.shift()
    if (!candidate) {
      this.shouldAdvanceToNextLabel = true
      return
    }

    const result = this.evaluateCornerCandidate(label, labelIndex, candidate)
    this.currentCandidateResults.push(result)

    if (result.status !== "valid") return

    result.selected = true
    this.applyCandidate(labelIndex, label, result)
    this.shouldAdvanceToNextLabel = true
  }

  getOutput() {
    return {
      netLabelPlacements: this.outputNetLabelPlacements,
    }
  }

  private getProcessableLabelIndices() {
    const labelIndices: number[] = []

    for (let i = 0; i < this.outputNetLabelPlacements.length; i++) {
      const label = this.outputNetLabelPlacements[i]!
      if (!this.shouldProcessLabel(label)) continue

      labelIndices.push(i)
    }

    return labelIndices
  }

  private prepareNextLabel() {
    const labelIndex = this.queuedLabelIndices.shift()
    if (labelIndex === undefined) {
      this.clearCurrentLabel()
      return false
    }

    const label = this.outputNetLabelPlacements[labelIndex]!
    this.currentLabelIndex = labelIndex
    this.currentLabel = label
    this.currentCandidateResults = []
    this.queuedCornerCandidates = this.getCornerCandidatesForLabel(label)

    return true
  }

  private advanceToNextLabel() {
    this.shouldAdvanceToNextLabel = false
    if (!this.prepareNextLabel()) this.finish()
  }

  private clearCurrentLabel() {
    this.currentLabelIndex = null
    this.currentLabel = null
    this.currentCandidateResults = []
    this.queuedCornerCandidates = []
  }

  private finish() {
    this.clearCurrentLabel()
    this.solved = true
  }

  private evaluateCornerCandidate(
    label: NetLabelPlacement,
    labelIndex: number,
    candidate: TraceCornerCandidate,
  ): EvaluatedCornerCandidate {
    const center = getCenterFromAnchor(
      candidate.anchorPoint,
      label.orientation,
      label.width,
      label.height,
    )
    const bounds = getRectBounds(center, label.width, label.height)

    return {
      ...candidate,
      center,
      width: label.width,
      height: label.height,
      status: this.getCandidateStatus(bounds, labelIndex),
      selected: false,
    }
  }

  private getCandidateStatus(
    bounds: Bounds,
    labelIndex: number,
  ): CornerCandidateStatus {
    if (this.intersectsAnyChip(bounds)) return "chip-collision"
    if (traceCrossesBoundsInterior(bounds, this.traceMap)) {
      return "trace-collision"
    }
    if (this.intersectsAnyOtherNetLabel(bounds, labelIndex)) {
      return "netlabel-collision"
    }

    return "valid"
  }

  private applyCandidate(
    labelIndex: number,
    label: NetLabelPlacement,
    candidate: EvaluatedCornerCandidate,
  ) {
    this.outputNetLabelPlacements[labelIndex] = {
      ...label,
      anchorPoint: candidate.anchorPoint,
      center: candidate.center,
    }
  }

  private shouldProcessLabel(label: NetLabelPlacement) {
    return (
      label.netId === "VCC" &&
      this.getCornerCandidatesForLabel(label).length > 0
    )
  }

  private intersectsAnyChip(bounds: Bounds) {
    return this.inputProblem.chips.some((chip) =>
      rectsOverlap(bounds, getRectBounds(chip.center, chip.width, chip.height)),
    )
  }

  private intersectsAnyOtherNetLabel(bounds: Bounds, labelIndex: number) {
    return this.outputNetLabelPlacements.some((label, index) => {
      if (index === labelIndex) return false
      return rectsOverlap(
        bounds,
        getRectBounds(label.center, label.width, label.height),
      )
    })
  }

  private getCornerCandidatesForLabel(label: NetLabelPlacement) {
    const candidates: TraceCornerCandidate[] = []
    const seenCornerKeys = new Set<string>()

    for (const trace of this.getTraceLinesForLabel(label)) {
      for (const anchorPoint of getTraceCorners(trace.tracePath)) {
        const key = `${anchorPoint.x}:${anchorPoint.y}`
        if (seenCornerKeys.has(key)) continue
        seenCornerKeys.add(key)
        candidates.push({
          anchorPoint,
          traceId: trace.mspPairId,
          distance: getDistance(anchorPoint, label.anchorPoint),
        })
      }
    }

    return candidates.sort((a, b) => a.distance - b.distance)
  }

  private getTraceLinesForLabel(label: NetLabelPlacement) {
    return this.traces.filter(
      (trace) => isTraceLine(trace) && this.isTraceForLabel(trace, label),
    )
  }

  private isTraceForLabel(trace: SolvedTracePath, label: NetLabelPlacement) {
    if (!tracePathContainsPoint(trace.tracePath, label.anchorPoint)) {
      return false
    }

    const traceIds = new Set(label.mspConnectionPairIds)
    if (traceIds.size > 0) {
      return traceIds.has(trace.mspPairId)
    }

    return trace.globalConnNetId === label.globalConnNetId
  }

  override visualize(): GraphicsObject {
    return visualizeVccNetLabelCornerPlacementSolver({
      inputProblem: this.inputProblem,
      traces: this.traces,
      outputNetLabelPlacements: this.outputNetLabelPlacements,
      currentLabel: this.currentLabel,
      currentCandidateResults: this.currentCandidateResults,
      solved: this.solved,
    })
  }
}
