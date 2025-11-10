import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "../../types/InputProblem"
import { MergedNetLabelObstacleSolver } from "./sub-solvers/LabelMergingSolver/LabelMergingSolver"
import { getColorFromString } from "lib/utils/getColorFromString"
import { OverlapAvoidanceStepSolver } from "./sub-solvers/OverlapAvoidanceStepSolver/OverlapAvoidanceStepSolver"

interface TraceLabelOverlapAvoidanceSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

/**
 * A pipeline solver responsible for resolving overlaps between schematic traces and net labels.
 *
 * This solver orchestrates a sequence of sub-solvers to achieve its goal:
 * 1. **MergedNetLabelObstacleSolver**: This solver first merges labels that are
 *    close to each other to form larger "obstacle" groups. This simplifies the
 *    problem by reducing the number of individual obstacles the traces need to avoid.
 * 2. **OverlapAvoidanceStepSolver**: This solver then takes the output of the merging
 *    step and iteratively attempts to reroute traces to avoid the merged label obstacles.
 *    It handles one overlap at a time, making it a step-by-step process.
 *
 * The final output is a set of modified traces that have been rerouted to avoid
 * labels, and the set of merged labels that were used as obstacles.
 *
 * @param {TraceLabelOverlapAvoidanceSolverInput} solverInput - The input for the solver,
 *   containing the initial traces, label placements, and the input problem definition.
 */
export class TraceLabelOverlapAvoidanceSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]

  // sub-solver instances
  labelMergingSolver?: MergedNetLabelObstacleSolver
  overlapAvoidanceSolver?: OverlapAvoidanceStepSolver
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
          traces: this.traces,
        })
        this.activeSubSolver = this.labelMergingSolver
        break

      case 1:
        this.overlapAvoidanceSolver = new OverlapAvoidanceStepSolver({
          inputProblem: this.inputProblem,
          traces: this.traces,
          originalNetLabelPlacements: this.netLabelPlacements, // The original, unfiltered list
          mergedNetLabelPlacements:
            this.labelMergingSolver!.getOutput().netLabelPlacements,
          mergedLabelNetIdMap:
            this.labelMergingSolver!.getOutput().mergedLabelNetIdMap,
        })
        this.activeSubSolver = this.overlapAvoidanceSolver
        break

      default:
        this.solved = true
        break
    }
  }

  getOutput() {
    return {
      traces: this.overlapAvoidanceSolver?.getOutput().allTraces ?? this.traces,
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
