import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "../../types/InputProblem"
import { LabelMergingSolver } from "./sub-solvers/LabelMergingSolver/LabelMergingSolver"
import { TraceCleanupSolver } from "./sub-solvers/TraceCleanupSolver/TraceCleanupSolver"
import { getColorFromString } from "lib/utils/getColorFromString"
import { NetLabelPlacementSolver } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { SingleOverlapSolver } from "./sub-solvers/SingleOverlapSolver/SingleOverlapSolver"
import { detectTraceLabelOverlap } from "./detectTraceLabelOverlap"

type Overlap = ReturnType<typeof detectTraceLabelOverlap>[0]

interface TraceLabelOverlapAvoidanceSolverInput {
  problem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
}

// Define a type for the input of the internal overlap solver to avoid conflicts
interface OverlapCollectionSolverInput {
  problem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
}

/**
 * This solver is a pipeline that runs a series of sub-solvers to resolve
 * trace-label overlaps and clean up the resulting traces.
 */
export class TraceLabelOverlapAvoidanceSolver extends BaseSolver {
  problem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>

  // sub-solver instances
  labelMergingSolver?: LabelMergingSolver
  overlapAvoidanceSolver?: OverlapAvoidanceStepSolver
  traceCleanupSolver?: TraceCleanupSolver
  pipelineStepIndex = 0

  constructor(solverInput: TraceLabelOverlapAvoidanceSolverInput) {
    super()
    this.problem = solverInput.problem
    this.traces = solverInput.traces
    this.netLabelPlacements = solverInput.netLabelPlacements
    this.mergedLabelNetIdMap = solverInput.mergedLabelNetIdMap
  }

  override _step() {
    // If a sub-solver is active, step it and check for completion.
    if (this.activeSubSolver) {
      this.activeSubSolver.step()

      if (this.activeSubSolver.solved) {
        this.activeSubSolver = null
        this.pipelineStepIndex++
      } else if (this.activeSubSolver.failed) {
        this.failed = true // If any sub-solver fails, the whole thing fails
        this.activeSubSolver = null
      }
      return // Return to allow the sub-solver to run
    }

    // If no sub-solver is active, create the next one in the pipeline.
    switch (this.pipelineStepIndex) {
      case 0:
        // Step 1: Label Merging (non-iterative)
        this.labelMergingSolver = new LabelMergingSolver({
          netLabelPlacements: this.netLabelPlacements,
        })
        this.labelMergingSolver.step() // Non-iterative, so one step is enough
        this.pipelineStepIndex++
        break

      case 1:
        // Step 2: Overlap Avoidance (iterative)
        this.overlapAvoidanceSolver = new OverlapAvoidanceStepSolver({
          problem: this.problem,
          traces: this.traces,
          netLabelPlacements:
            this.labelMergingSolver!.getOutput().netLabelPlacements,
          mergedLabelNetIdMap:
            this.labelMergingSolver!.getOutput().mergedLabelNetIdMap,
        })
        this.activeSubSolver = this.overlapAvoidanceSolver
        break

      case 2:
        // Step 3: Trace Cleanup (non-iterative)
        this.traceCleanupSolver = new TraceCleanupSolver({
          problem: this.problem,
          allTraces: this.overlapAvoidanceSolver!.getOutput().allTraces,
          targetTraceIds: new Set(
            this.overlapAvoidanceSolver!.getOutput().modifiedTraces.map(
              (t) => t.mspPairId,
            ),
          ),
          allLabelPlacements:
            this.labelMergingSolver!.getOutput().netLabelPlacements,
          mergedLabelNetIdMap:
            this.labelMergingSolver!.getOutput().mergedLabelNetIdMap,
          paddingBuffer: 0.01,
        })
        this.traceCleanupSolver.step() // Non-iterative
        this.pipelineStepIndex++
        break

      default:
        this.solved = true
        break
    }
  }

  getOutput() {
    return {
      traces: this.traceCleanupSolver?.getOutput().traces ?? this.traces,
      netLabelPlacements:
        this.labelMergingSolver?.getOutput().netLabelPlacements ??
        this.netLabelPlacements,
    }
  }

  override visualize(): GraphicsObject {
    if (this.activeSubSolver) {
      return this.activeSubSolver.visualize()
    }

    // When no sub-solver is active, show the current state of the pipeline
    const graphics = visualizeInputProblem(this.problem)
    if (!graphics.lines) graphics.lines = []
    if (!graphics.rects) graphics.rects = []

    const output = this.getOutput()

    for (const trace of output.traces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    for (const label of output.netLabelPlacements) {
      const color = getColorFromString(label.globalConnNetId, 0.3)
      graphics.rects!.push({
        center: label.center,
        width: label.width,
        height: label.height,
        fill: color,
        stroke: color.replace("0.3", "1"),
        label: label.globalConnNetId,
      })
    }

    return graphics
  }
}

/**
 * This is an internal solver that manages the step-by-step process of avoiding
 * multiple overlaps. It follows the pattern of SchematicTraceLinesSolver.
 */
class OverlapAvoidanceStepSolver extends BaseSolver {
  problem: InputProblem
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
    this.problem = solverInput.problem
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
    if (this.activeSubSolver) {
      return this.activeSubSolver.visualize()
    }
    // When idle, show all the traces
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
