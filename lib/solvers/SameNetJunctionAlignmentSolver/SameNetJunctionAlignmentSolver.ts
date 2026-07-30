import type { GraphicsObject, Rect } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { alignSameNetJunctions } from "./alignSameNetJunctions"

interface SameNetJunctionAlignmentSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

/** Turns separate same-net load traces into one shared rail with short junction branches. */
export class SameNetJunctionAlignmentSolver extends BaseSolver {
  private input: SameNetJunctionAlignmentSolverInput
  outputTraces: SolvedTracePath[]

  constructor(input: SameNetJunctionAlignmentSolverInput) {
    super()
    this.input = input
    this.outputTraces = input.traces
  }

  override _step() {
    const result = alignSameNetJunctions(this.input)
    this.outputTraces = result.traces
    this.stats.alignedJunctionCount = result.alignedJunctionCount
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      netLabelPlacements: this.input.netLabelPlacements,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.input.inputProblem)
    graphics.lines ??= []
    graphics.rects ??= []
    graphics.points ??= []
    for (const trace of this.outputTraces) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }
    for (const label of this.input.netLabelPlacements) {
      const labelRect: Rect & { strokeColor: string } = {
        center: label.center,
        width: label.width,
        height: label.height,
        fill: getColorFromString(label.globalConnNetId, 0.35),
        strokeColor: getColorFromString(label.globalConnNetId, 0.9),
        label: `netId: ${label.netId}\nglobalConnNetId: ${label.globalConnNetId}`,
      }
      graphics.rects.push(labelRect)
      graphics.points.push({
        x: label.anchorPoint.x,
        y: label.anchorPoint.y,
        color: getColorFromString(label.globalConnNetId, 0.9),
        label: `anchorPoint\norientation: ${label.orientation}`,
      })
    }
    return graphics
  }
}
