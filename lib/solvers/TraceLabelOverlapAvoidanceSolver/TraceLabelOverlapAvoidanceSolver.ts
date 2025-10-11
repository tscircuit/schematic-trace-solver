import { BaseSolver } from "../BaseSolver/BaseSolver"
import { detectTraceLabelOverlap } from "./detectTraceLabelOverlap"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { TraceLabelOverlapAvoidanceSubSolver } from "./TraceLabelOverlapAvoidanceSubSolver"

type Overlap = ReturnType<typeof detectTraceLabelOverlap>[0]

interface TraceLabelOverlapAvoidanceSolverInput {
  problem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
}

export class TraceLabelOverlapAvoidanceSolver extends BaseSolver {
  private problem: InputProblem
  private netLabelPlacements: NetLabelPlacement[]
  private mergedLabelNetIdMap: Record<string, Set<string>>

  private allTraces: SolvedTracePath[]
  private modifiedTraces: SolvedTracePath[] = []

  private detourCountByLabel: Record<string, number> = {}
  private readonly PADDING_BUFFER = 0.1

  private subSolver: TraceLabelOverlapAvoidanceSubSolver | null = null
  private overlapQueue: Overlap[] = []

  constructor(solverInput: TraceLabelOverlapAvoidanceSolverInput) {
    super()
    this.problem = solverInput.problem
    this.netLabelPlacements = solverInput.netLabelPlacements
    this.mergedLabelNetIdMap = solverInput.mergedLabelNetIdMap
    this.allTraces = [...solverInput.traces]
  }

  override _step() {
    if (this.subSolver) {
      this.subSolver.step()

      if (this.subSolver.solved) {
        const solvedPath = this.subSolver.solvedTracePath
        if (solvedPath) {
          const traceIndex = this.allTraces.findIndex(
            (t) => t.mspPairId === this.subSolver!.initialTrace.mspPairId,
          )
          if (traceIndex !== -1) {
            this.allTraces[traceIndex].tracePath = solvedPath
            this.modifiedTraces.push(this.allTraces[traceIndex])
          }
        }
        this.subSolver = null
      } else if (this.subSolver.failed) {
        // TODO: What to do if a sub-solver fails? For now, just move on
        this.subSolver = null
      }
      return // Wait for sub-solver to finish
    }

    if (
      !this.allTraces ||
      this.allTraces.length === 0 ||
      !this.netLabelPlacements ||
      this.netLabelPlacements.length === 0
    ) {
      this.solved = true
      return
    }

    const overlaps = detectTraceLabelOverlap(
      this.allTraces,
      this.netLabelPlacements,
    ).filter((o) => {
      const originalNetIds = this.mergedLabelNetIdMap[o.label.globalConnNetId]
      if (originalNetIds) {
        return !originalNetIds.has(o.trace.globalConnNetId)
      }
      return o.trace.globalConnNetId !== o.label.globalConnNetId
    })

    if (overlaps.length === 0) {
      this.solved = true
      return
    }

    this.overlapQueue = overlaps

    const nextOverlap = this.overlapQueue.shift()

    if (nextOverlap) {
      const traceToFix = this.allTraces.find(
        (t) => t.mspPairId === nextOverlap.trace.mspPairId,
      )
      if (traceToFix) {
        const labelId = nextOverlap.label.globalConnNetId
        const detourCount = this.detourCountByLabel[labelId] || 0
        this.detourCountByLabel[labelId] = detourCount + 1

        this.subSolver = new TraceLabelOverlapAvoidanceSubSolver({
          trace: traceToFix,
          label: nextOverlap.label,
          problem: this.problem,
          paddingBuffer: this.PADDING_BUFFER,
          detourCount,
        })
      }
    }
  }

  getOutput() {
    return {
      allTraces: this.allTraces,
      modifiedTraces: this.modifiedTraces,
    }
  }

  override visualize(): GraphicsObject {
    if (this.subSolver) {
      return this.subSolver.visualize()
    }

    const graphics = visualizeInputProblem(this.problem)

    if (!graphics.lines) graphics.lines = []

    for (const trace of this.allTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    // You can add visualization for overlaps here if needed

    return graphics
  }
}
