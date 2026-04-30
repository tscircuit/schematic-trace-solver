import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { generateCandidatesAlongTrace } from "./candidates"
import {
  getLabelBounds,
  getTraceLocationsForPoint,
  rectsOverlap,
  rectsTouchOrOverlap,
  traceCrossesBoundsInterior,
} from "./geometry"
import type {
  Bounds,
  CandidateStatus,
  LabelCandidate,
  LabelOverlap,
  TraceAnchoredNetLabelOverlapSolverParams,
} from "./types"
import { visualizeTraceAnchoredNetLabelOverlapSolver } from "./visualize"

type ActiveOverlapSearch = {
  overlap: LabelOverlap
  queuedLabelIndices: number[]
  labelIndex: number | null
  candidates: LabelCandidate[]
  candidateIndex: number
  candidateResults: LabelCandidate[]
  completed: boolean
}

export class TraceAnchoredNetLabelOverlapSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]

  outputNetLabelPlacements: NetLabelPlacement[]
  currentOverlap: LabelOverlap | null = null
  currentCandidateResults: LabelCandidate[] = []

  private activeSearch: ActiveOverlapSearch | null = null
  private skippedOverlapKeys = new Set<string>()

  constructor(params: TraceAnchoredNetLabelOverlapSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.traces = params.traces
    this.netLabelPlacements = params.netLabelPlacements
    this.outputNetLabelPlacements = [...params.netLabelPlacements]
  }

  override getConstructorParams(): ConstructorParameters<
    typeof TraceAnchoredNetLabelOverlapSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.traces,
      netLabelPlacements: this.netLabelPlacements,
    }
  }

  override _step() {
    if (this.activeSearch?.completed) this.clearActiveSearch()

    const search = this.getNextSearchWithCandidates()
    if (!search) {
      this.finish()
      return
    }

    this.evaluateNextCandidate(search)
  }

  getOutput() {
    return {
      netLabelPlacements: this.outputNetLabelPlacements,
    }
  }

  private findNextOverlap() {
    for (let i = 0; i < this.outputNetLabelPlacements.length; i++) {
      for (let j = i + 1; j < this.outputNetLabelPlacements.length; j++) {
        if (!this.isLabelEligible(i) && !this.isLabelEligible(j)) continue

        const overlap = {
          firstLabelIndex: i,
          secondLabelIndex: j,
        }
        if (this.skippedOverlapKeys.has(this.getOverlapKey(overlap))) continue
        if (this.labelsOverlap(overlap)) return overlap
      }
    }

    return null
  }

  private isLabelEligible(labelIndex: number) {
    return this.getTraceLocationsForLabel(labelIndex).length > 0
  }

  private labelsOverlap(overlap: LabelOverlap) {
    const first = this.outputNetLabelPlacements[overlap.firstLabelIndex]
    const second = this.outputNetLabelPlacements[overlap.secondLabelIndex]
    if (!first || !second) return false

    return rectsOverlap(getLabelBounds(first), getLabelBounds(second))
  }

  private startNextOverlapSearch() {
    const overlap = this.findNextOverlap()
    if (!overlap) return null

    const search: ActiveOverlapSearch = {
      overlap,
      queuedLabelIndices: this.getMoveLabelIndices(overlap),
      labelIndex: null,
      candidates: [],
      candidateIndex: 0,
      candidateResults: [],
      completed: false,
    }

    this.setActiveSearch(search)
    return search
  }

  private getMoveLabelIndices(overlap: LabelOverlap) {
    const labelIndices: number[] = []

    if (this.isLabelEligible(overlap.secondLabelIndex)) {
      labelIndices.push(overlap.secondLabelIndex)
    }
    if (this.isLabelEligible(overlap.firstLabelIndex)) {
      labelIndices.push(overlap.firstLabelIndex)
    }

    return labelIndices
  }

  private getNextSearchWithCandidates() {
    while (true) {
      const search = this.activeSearch ?? this.startNextOverlapSearch()
      if (!search) return null
      if (this.activateNextLabelSearch(search)) return search

      this.skipSearch(search)
    }
  }

  private activateNextLabelSearch(search: ActiveOverlapSearch) {
    if (
      search.labelIndex !== null &&
      search.candidateIndex < search.candidates.length
    ) {
      return true
    }

    while (search.queuedLabelIndices.length > 0) {
      const labelIndex = search.queuedLabelIndices.shift()!
      const label = this.outputNetLabelPlacements[labelIndex]
      if (!label) continue

      search.labelIndex = labelIndex
      search.candidates = this.getCandidatesForLabel(label)
      search.candidateIndex = 0
      if (search.candidates.length > 0) return true
    }

    search.labelIndex = null
    search.candidates = []
    search.candidateIndex = 0
    return false
  }

  private skipSearch(search: ActiveOverlapSearch) {
    this.skippedOverlapKeys.add(this.getOverlapKey(search.overlap))
    this.clearActiveSearch()
  }

  private evaluateNextCandidate(search: ActiveOverlapSearch) {
    const labelIndex = search.labelIndex
    if (labelIndex === null) return

    const label = this.outputNetLabelPlacements[labelIndex]
    const candidate = search.candidates[search.candidateIndex]
    if (!label || !candidate) return

    search.candidateIndex += 1

    const evaluatedCandidate = {
      ...candidate,
      status: this.getCandidateStatus(candidate, labelIndex),
    }
    search.candidateResults.push(evaluatedCandidate)

    if (evaluatedCandidate.status !== "valid") return

    evaluatedCandidate.selected = true
    this.applyCandidate(labelIndex, label, evaluatedCandidate)
    search.completed = true
  }

  private getCandidatesForLabel(label: NetLabelPlacement) {
    const candidates: LabelCandidate[] = []

    for (const traceLocation of getTraceLocationsForPoint(
      label.anchorPoint,
      this.traces,
    ).filter(({ trace }) => this.isTraceAssociatedWithLabel(trace, label))) {
      candidates.push(
        ...generateCandidatesAlongTrace({
          inputProblem: this.inputProblem,
          label,
          traceLocation,
        }),
      )
    }

    return candidates
  }

  private getCandidateStatus(
    candidate: LabelCandidate,
    labelIndex: number,
  ): CandidateStatus {
    const bounds = getLabelBounds(candidate)
    if (this.intersectsAnyChip(bounds)) return "chip-collision"
    if (traceCrossesBoundsInterior(bounds, this.traces))
      return "trace-collision"
    if (this.intersectsAnyOtherLabel(bounds, labelIndex)) {
      return "netlabel-collision"
    }

    return "valid"
  }

  private applyCandidate(
    labelIndex: number,
    label: NetLabelPlacement,
    candidate: LabelCandidate,
  ) {
    this.outputNetLabelPlacements[labelIndex] = {
      ...label,
      anchorPoint: candidate.anchorPoint,
      center: candidate.center,
      width: candidate.width,
      height: candidate.height,
      orientation: candidate.orientation,
    }
  }

  private intersectsAnyChip(bounds: Bounds) {
    return this.inputProblem.chips.some((chip) =>
      rectsTouchOrOverlap(
        bounds,
        getRectBounds(chip.center, chip.width, chip.height),
      ),
    )
  }

  private intersectsAnyOtherLabel(bounds: Bounds, labelIndex: number) {
    return this.outputNetLabelPlacements.some((label, index) => {
      if (index === labelIndex) return false
      return rectsOverlap(bounds, getLabelBounds(label))
    })
  }

  private getTraceLocationsForLabel(labelIndex: number) {
    const label = this.outputNetLabelPlacements[labelIndex]
    if (!label) return []

    return getTraceLocationsForPoint(label.anchorPoint, this.traces).filter(
      ({ trace }) => this.isTraceAssociatedWithLabel(trace, label),
    )
  }

  private isTraceAssociatedWithLabel(
    trace: SolvedTracePath,
    label: NetLabelPlacement,
  ) {
    if (label.mspConnectionPairIds.includes(trace.mspPairId)) return true
    if (label.netId !== undefined && label.netId === trace.userNetId) {
      return true
    }

    return label.globalConnNetId === trace.globalConnNetId
  }

  private getOverlapKey(overlap: LabelOverlap) {
    const first = this.outputNetLabelPlacements[overlap.firstLabelIndex]
    const second = this.outputNetLabelPlacements[overlap.secondLabelIndex]
    return [
      overlap.firstLabelIndex,
      overlap.secondLabelIndex,
      first?.anchorPoint.x,
      first?.anchorPoint.y,
      second?.anchorPoint.x,
      second?.anchorPoint.y,
    ].join(":")
  }

  private finish() {
    this.clearActiveSearch()
    this.solved = true
  }

  private setActiveSearch(search: ActiveOverlapSearch) {
    this.activeSearch = search
    this.currentOverlap = search.overlap
    this.currentCandidateResults = search.candidateResults
  }

  private clearActiveSearch() {
    this.activeSearch = null
    this.currentOverlap = null
    this.currentCandidateResults = []
  }

  override visualize(): GraphicsObject {
    return visualizeTraceAnchoredNetLabelOverlapSolver({
      inputProblem: this.inputProblem,
      traces: this.traces,
      outputNetLabelPlacements: this.outputNetLabelPlacements,
      currentOverlap: this.currentOverlap,
      currentCandidateResults: this.currentCandidateResults,
      solved: this.solved,
    })
  }
}
