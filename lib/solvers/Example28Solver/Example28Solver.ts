import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import {
  detectTraceLabelOverlap,
  type TraceLabelOverlap,
} from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import type { InputProblem } from "lib/types/InputProblem"
import { moveAttachedLabelsToReroutedTrace } from "./label-movement"
import { findBestReroutePath } from "./reroute"
import type { Example28SolverParams, RerouteCandidateResult } from "./types"
import { visualizeExample28Solver } from "./visualize"

export class Example28Solver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]

  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  queuedOverlaps: TraceLabelOverlap[] = []
  currentOverlap: TraceLabelOverlap | null = null
  currentCandidateResults: RerouteCandidateResult[] = []

  private chipObstacles: ReturnType<typeof getObstacleRects>

  constructor(params: Example28SolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.traces = params.traces
    this.netLabelPlacements = params.netLabelPlacements
    this.outputTraces = [...params.traces]
    this.outputNetLabelPlacements = [...params.netLabelPlacements]
    this.chipObstacles = getObstacleRects(params.inputProblem)
    this.initializeQueuedOverlaps()
    this.currentOverlap = this.queuedOverlaps[0] ?? null
  }

  override getConstructorParams(): ConstructorParameters<
    typeof Example28Solver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.traces,
      netLabelPlacements: this.netLabelPlacements,
    }
  }

  override _step() {
    const overlap = this.queuedOverlaps.shift()
    if (!overlap) {
      this.finish()
      return
    }

    if (!this.isOverlapStillPresent(overlap)) {
      this.currentOverlap = overlap
      this.currentCandidateResults = []
      return
    }

    this.rerouteOverlappingTrace(overlap)
  }

  private finish() {
    this.currentOverlap = null
    this.currentCandidateResults = []
    this.solved = true
  }

  private initializeQueuedOverlaps() {
    const queuedOverlaps: TraceLabelOverlap[] = []
    const seenPairs = new Set<string>()

    for (const overlap of this.getTraceLabelOverlaps()) {
      if (!this.shouldRerouteOverlap(overlap)) continue

      const key = this.getOverlapKey(overlap)
      if (seenPairs.has(key)) continue

      seenPairs.add(key)
      queuedOverlaps.push(overlap)
    }

    this.queuedOverlaps = queuedOverlaps
  }

  private getTraceLabelOverlaps() {
    return detectTraceLabelOverlap({
      traces: this.outputTraces,
      netLabels: this.outputNetLabelPlacements,
    })
  }

  private shouldRerouteOverlap(overlap: TraceLabelOverlap) {
    return (
      this.isXFacingLabel(overlap.label) &&
      !this.hasExplicitOrientationConstraint(overlap.label)
    )
  }

  private isXFacingLabel(label: NetLabelPlacement) {
    return label.orientation === "x+" || label.orientation === "x-"
  }

  private hasExplicitOrientationConstraint(label: NetLabelPlacement) {
    const effectiveNetId = label.netId ?? label.globalConnNetId
    return Object.hasOwn(
      this.inputProblem.availableNetLabelOrientations,
      effectiveNetId,
    )
  }

  private getOverlapKey(overlap: TraceLabelOverlap) {
    const labelNetId = overlap.label.netId ?? overlap.label.globalConnNetId
    return `${overlap.trace.mspPairId}:${labelNetId}:${overlap.label.anchorPoint.x}:${overlap.label.anchorPoint.y}`
  }

  private isOverlapStillPresent(overlap: TraceLabelOverlap) {
    const currentTrace = this.getCurrentTrace(overlap.trace)
    if (!currentTrace) return false

    return (
      detectTraceLabelOverlap({
        traces: [currentTrace],
        netLabels: [overlap.label],
      }).length > 0
    )
  }

  private getCurrentTrace(trace: SolvedTracePath) {
    return this.outputTraces.find((t) => t.mspPairId === trace.mspPairId)
  }

  private rerouteOverlappingTrace(overlap: TraceLabelOverlap) {
    this.currentOverlap = overlap
    this.currentCandidateResults = []

    const traceIndex = this.outputTraces.findIndex(
      (trace) => trace.mspPairId === overlap.trace.mspPairId,
    )
    if (traceIndex === -1) return

    const currentTrace = this.outputTraces[traceIndex]!
    const rerouteResult = findBestReroutePath({
      trace: currentTrace,
      obstacleLabel: overlap.label,
      inputProblem: this.inputProblem,
      outputTraces: this.outputTraces,
      outputNetLabelPlacements: this.outputNetLabelPlacements,
      chipObstacles: this.chipObstacles,
    })
    this.currentCandidateResults = rerouteResult.candidateResults

    if (!rerouteResult.bestPath) return

    const originalTracePath = currentTrace.tracePath
    this.outputTraces[traceIndex] = {
      ...currentTrace,
      tracePath: rerouteResult.bestPath,
    }
    this.outputNetLabelPlacements = moveAttachedLabelsToReroutedTrace({
      trace: currentTrace,
      originalTracePath,
      reroutedTracePath: rerouteResult.bestPath,
      netLabelPlacements: this.outputNetLabelPlacements,
    })
  }

  override visualize(): GraphicsObject {
    return visualizeExample28Solver({
      inputProblem: this.inputProblem,
      outputTraces: this.outputTraces,
      outputNetLabelPlacements: this.outputNetLabelPlacements,
      solved: this.solved,
      currentOverlap: this.currentOverlap,
      currentCandidateResults: this.currentCandidateResults,
    })
  }
}
