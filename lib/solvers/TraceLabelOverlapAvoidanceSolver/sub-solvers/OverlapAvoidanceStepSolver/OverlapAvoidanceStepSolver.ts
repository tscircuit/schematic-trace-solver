import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { detectTraceLabelOverlap } from "../../detectTraceLabelOverlap"
import { SingleOverlapSolver } from "../SingleOverlapSolver/SingleOverlapSolver"

type Overlap = ReturnType<typeof detectTraceLabelOverlap>[0]

// Define a type for the input of the internal overlap solver to avoid conflicts
interface OverlapCollectionSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
}

/**
 * This is an internal solver that manages the step-by-step process of avoiding
 * multiple overlaps. It follows the pattern of SchematicTraceLinesSolver.
 */
export class OverlapAvoidanceStepSolver extends BaseSolver {
  inputProblem: InputProblem
  netLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>

  allTraces: SolvedTracePath[]
  modifiedTraces: SolvedTracePath[] = []

  private detourCountByLabel: Record<string, number> = {}
  private readonly PADDING_BUFFER = 0.1

  public override activeSubSolver: SingleOverlapSolver | null = null
  private overlapQueue: Overlap[] = []
  private recentlyFailed: Set<string> = new Set()

  constructor(solverInput: OverlapCollectionSolverInput) {
    super()
    this.inputProblem = solverInput.inputProblem
    this.netLabelPlacements = solverInput.netLabelPlacements
    this.mergedLabelNetIdMap = solverInput.mergedLabelNetIdMap
    this.allTraces = [...solverInput.traces]
  }

  override _step() {
    if (this.activeSubSolver) {
      this.activeSubSolver.step()

      if (this.activeSubSolver.solved) {
        const solvedPath = this.activeSubSolver.solvedTracePath
        if (solvedPath) {
          const traceIndex = this.allTraces.findIndex(
            (t) => t.mspPairId === this.activeSubSolver!.initialTrace.mspPairId,
          )
          if (traceIndex !== -1) {
            this.allTraces[traceIndex].tracePath = solvedPath
            this.modifiedTraces.push(this.allTraces[traceIndex])
          }
        }
        this.activeSubSolver = null
        this.recentlyFailed.clear()
      } else if (this.activeSubSolver.failed) {
        const overlapId = `${this.activeSubSolver.initialTrace.mspPairId}-${this.activeSubSolver.label.globalConnNetId}`
        this.recentlyFailed.add(overlapId)
        this.activeSubSolver = null
      }
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

    const nonFailedOverlaps = overlaps.filter((o) => {
      const overlapId = `${o.trace.mspPairId}-${o.label.globalConnNetId}`
      return !this.recentlyFailed.has(overlapId)
    })

    if (nonFailedOverlaps.length === 0) {
      this.solved = true // No more progress can be made
      return
    }

    this.overlapQueue = nonFailedOverlaps

    const nextOverlap = this.overlapQueue.shift()

    if (nextOverlap) {
      const traceToFix = this.allTraces.find(
        (t) => t.mspPairId === nextOverlap.trace.mspPairId,
      )
      if (traceToFix) {
        const labelId = nextOverlap.label.globalConnNetId
        const detourCount = this.detourCountByLabel[labelId] || 0
        this.detourCountByLabel[labelId] = detourCount + 1

        this.activeSubSolver = new SingleOverlapSolver({
          trace: traceToFix,
          label: nextOverlap.label,
          problem: this.inputProblem,
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
    if (this.activeSubSolver) {
      return this.activeSubSolver.visualize()
    }
    // When idle, show all the traces
    const graphics = visualizeInputProblem(this.inputProblem)
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
