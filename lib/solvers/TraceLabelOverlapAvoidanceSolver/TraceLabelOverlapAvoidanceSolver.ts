import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "../../types/InputProblem"
import { MergedNetLabelObstacleSolver } from "./sub-solvers/LabelMergingSolver/LabelMergingSolver"
import { TraceCleanupSolver } from "./sub-solvers/TraceCleanupSolver/TraceCleanupSolver"
import { getColorFromString } from "lib/utils/getColorFromString"
import { OverlapAvoidanceStepSolver } from "./sub-solvers/OverlapAvoidanceStepSolver/OverlapAvoidanceStepSolver"

interface TraceLabelOverlapAvoidanceSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

/**
 * This solver is a pipeline that runs a series of sub-solvers to resolve
 * trace-label overlaps and clean up the resulting traces.
 */
export class TraceLabelOverlapAvoidanceSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]

  // sub-solver instances
  labelMergingSolver?: MergedNetLabelObstacleSolver
  overlapAvoidanceSolver?: OverlapAvoidanceStepSolver
  traceCleanupSolver?: TraceCleanupSolver
  pipelineStepIndex = 0

  constructor(solverInput: TraceLabelOverlapAvoidanceSolverInput) {
    super()
    this.inputProblem = solverInput.inputProblem
    this.traces = solverInput.traces
    this.netLabelPlacements = solverInput.netLabelPlacements
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
        this.labelMergingSolver = new MergedNetLabelObstacleSolver({
          netLabelPlacements: this.netLabelPlacements,
          inputProblem: this.inputProblem,
        })
        this.activeSubSolver = this.labelMergingSolver
        break

      case 1:
        this.overlapAvoidanceSolver = new OverlapAvoidanceStepSolver({
          inputProblem: this.inputProblem,
          traces: this.traces,
          netLabelPlacements:
            this.labelMergingSolver!.getOutput().netLabelPlacements,
          mergedLabelNetIdMap:
            this.labelMergingSolver!.getOutput().mergedLabelNetIdMap,
        })
        this.activeSubSolver = this.overlapAvoidanceSolver
        break

      case 2:
        this.traceCleanupSolver = new TraceCleanupSolver({
          inputProblem: this.inputProblem,
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
        this.activeSubSolver = this.traceCleanupSolver
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
    const graphics = visualizeInputProblem(this.inputProblem)
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
