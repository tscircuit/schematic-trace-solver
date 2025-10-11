import { BaseSolver } from "../BaseSolver/BaseSolver"
import { detectTraceLabelOverlap } from "./detectTraceLabelOverlap"
import { rerouteCollidingTrace } from "./rerouteCollidingTrace"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import type { InputProblem } from "lib/types/InputProblem"

interface TraceLabelOverlapAvoidanceSolverInput {
  problem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
}

export class TraceLabelOverlapAvoidanceSolver extends BaseSolver {
  private problem: InputProblem
  private traces: SolvedTracePath[]
  private netLabelPlacements: NetLabelPlacement[]
  private mergedLabelNetIdMap: Record<string, Set<string>>

  private allTraces: SolvedTracePath[]
  private modifiedTraces: SolvedTracePath[] = []

  private detourCountByLabel: Record<string, number> = {}
  private readonly PADDING_BUFFER = 0.1

  constructor(solverInput: TraceLabelOverlapAvoidanceSolverInput) {
    super()
    this.problem = solverInput.problem
    this.traces = solverInput.traces
    this.netLabelPlacements = solverInput.netLabelPlacements
    this.mergedLabelNetIdMap = solverInput.mergedLabelNetIdMap
    this.allTraces = [...solverInput.traces]
  }

  override _step() {
    if (
      !this.traces ||
      this.traces.length === 0 ||
      !this.netLabelPlacements ||
      this.netLabelPlacements.length === 0
    ) {
      this.solved = true
      return
    }

    const overlaps = detectTraceLabelOverlap(
      this.traces,
      this.netLabelPlacements,
    )

    if (overlaps.length === 0) {
      this.solved = true
      return
    }

    const unfriendlyOverlaps = overlaps.filter((o) => {
      const originalNetIds = this.mergedLabelNetIdMap[o.label.globalConnNetId]
      if (originalNetIds) {
        return !originalNetIds.has(o.trace.globalConnNetId)
      }
      return o.trace.globalConnNetId !== o.label.globalConnNetId
    })

    if (unfriendlyOverlaps.length === 0) {
      this.solved = true
      return
    }

    const updatedTracesMap: Record<string, SolvedTracePath> = {}
    for (const trace of this.traces) {
      updatedTracesMap[trace.mspPairId] = trace
    }

    const processedTraceIds = new Set<string>()

    for (const overlap of unfriendlyOverlaps) {
      if (processedTraceIds.has(overlap.trace.mspPairId)) {
        continue
      }

      const currentTraceState = updatedTracesMap[overlap.trace.mspPairId]!
      const labelId = overlap.label.globalConnNetId
      const detourCount = this.detourCountByLabel[labelId] || 0

      const newTrace = rerouteCollidingTrace({
        trace: currentTraceState,
        label: overlap.label,
        problem: this.problem,
        paddingBuffer: this.PADDING_BUFFER,
        detourCount,
      })

      if (newTrace.tracePath !== currentTraceState.tracePath) {
        this.detourCountByLabel[labelId] = detourCount + 1
        this.modifiedTraces.push(newTrace)
      }

      updatedTracesMap[currentTraceState.mspPairId] = newTrace
      processedTraceIds.add(currentTraceState.mspPairId)
    }

    this.allTraces = Object.values(updatedTracesMap)
    this.solved = true
  }

  getOutput() {
    return {
      allTraces: this.allTraces,
      modifiedTraces: this.modifiedTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.problem)

    if (!graphics.lines) graphics.lines = []

    for (const trace of this.allTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    return graphics
  }
}
