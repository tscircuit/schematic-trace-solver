import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  mergeSameNetTraces,
  type MergeSameNetTracesOptions,
} from "./mergeSameNetTraces"

export interface SameNetTraceMergeSolverInput
  extends MergeSameNetTracesOptions {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements?: NetLabelPlacement[]
}

/**
 * Pipeline phase that combines same-net trace segments that run close together
 * (see tscircuit/schematic-trace-solver#29 and #34). Shorter parallel segments
 * of the same net are snapped onto the dominant line so the schematic renders a
 * single continuous trace instead of several near-duplicate lines.
 *
 * This phase only adjusts geometry; it never merges across different nets and it
 * passes net-label placements through unchanged.
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  mergeDistanceThreshold?: number

  constructor(input: SameNetTraceMergeSolverInput) {
    super()
    this.inputProblem = input.inputProblem
    this.inputTraces = input.traces
    this.netLabelPlacements = input.netLabelPlacements ?? []
    this.mergeDistanceThreshold = input.mergeDistanceThreshold
    this.outputTraces = input.traces
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceMergeSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.inputTraces,
      netLabelPlacements: this.netLabelPlacements,
      mergeDistanceThreshold: this.mergeDistanceThreshold,
    }
  }

  override _step() {
    this.outputTraces = mergeSameNetTraces(this.inputTraces, {
      mergeDistanceThreshold: this.mergeDistanceThreshold,
    })
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      netLabelPlacements: this.netLabelPlacements,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)
    graphics.lines ??= []
    graphics.texts ??= []

    for (const trace of this.outputTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "green",
      })
    }

    for (const label of this.netLabelPlacements) {
      graphics.texts!.push({
        x: label.center.x,
        y: label.center.y,
        text: label.netId ?? label.globalConnNetId,
        color: "blue",
      })
    }

    return graphics
  }
}
