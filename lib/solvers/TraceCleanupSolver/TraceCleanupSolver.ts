import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import { minimizeTurnsWithFilteredLabels } from "./minimizeTurnsWithFilteredLabels"
import { balanceZShapes } from "./balanceZShapes"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { simplifyPath } from "./simplifyPath"
import { mergeSameNetTraces } from "./mergeSameNetTraces"

/**
 * Defines the input structure for the TraceCleanupSolver.
 */
interface TraceCleanupSolverInput {
  inputProblem: InputProblem
  allTraces: SolvedTracePath[]
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
}

import { UntangleTraceSubsolver } from "./sub-solver/UntangleTraceSubsolver"
import { is4PointRectangle } from "./is4PointRectangle"

/**
 * Represents the different stages or steps within the trace cleanup pipeline.
 */
type PipelineStep =
  | "minimizing_turns"
  | "balancing_l_shapes"
  | "untangling_traces"
  | "merging_same_net_traces"

/**
 * TraceCleanupSolver performs post-processing cleanup on solved traces,
 * including minimizing turns, balancing shapes, untangling, and merging
 * same-net traces.
 */
export class TraceCleanupSolver extends BaseSolver {
  cleanedTraces: SolvedTracePath[] = []
  currentStep: PipelineStep = "minimizing_turns"
  untangleSubsolver: UntangleTraceSubsolver | null = null
  input: TraceCleanupSolverInput

  constructor(input: TraceCleanupSolverInput) {
    super()
    this.input = input
  }

  _step() {
    const {
      inputProblem,
      allTraces,
      allLabelPlacements,
      mergedLabelNetIdMap,
      paddingBuffer,
    } = this.input

    if (this.currentStep === "minimizing_turns") {
      this.cleanedTraces = allTraces.map((trace: SolvedTracePath) => {
        const newPath = minimizeTurnsWithFilteredLabels(
          trace.tracePath,
          allLabelPlacements,
        )
        return { ...trace, tracePath: newPath.tracePath }
      })
      this.currentStep = "balancing_l_shapes"
      return
    }

    if (this.currentStep === "balancing_l_shapes") {
      this.cleanedTraces = this.cleanedTraces.map((trace: SolvedTracePath) => {
        const newPath = balanceZShapes({
          targetMspConnectionPairId: trace.mspConnectionPairIds[0],
          traces: this.cleanedTraces,
          inputProblem,
          allLabelPlacements,
          mergedLabelNetIdMap,
          paddingBuffer,
        })
        return { ...trace, tracePath: newPath }
      })
      this.currentStep = "untangling_traces"
      return
    }

    if (this.currentStep === "untangling_traces") {
      if (!this.untangleSubsolver) {
        this.untangleSubsolver = new UntangleTraceSubsolver({
          inputProblem,
          allTraces: this.cleanedTraces,
          allLabelPlacements,
          mergedLabelNetIdMap,
          paddingBuffer,
        })
      }
      if (!this.untangleSubsolver.solved) {
        this.untangleSubsolver._step()
        return
      }
      this.cleanedTraces = this.untangleSubsolver.getOutput().cleanedTraces
      this.currentStep = "merging_same_net_traces"
      return
    }

    if (this.currentStep === "merging_same_net_traces") {
      this.cleanedTraces = mergeSameNetTraces(
        this.cleanedTraces,
        mergedLabelNetIdMap,
      )

      // Final simplification pass
      this.cleanedTraces = this.cleanedTraces.map((trace: SolvedTracePath) => {
        const simplified = simplifyPath(trace.tracePath)
        return { ...trace, tracePath: simplified }
      })

      this.solved = true
      return
    }
  }

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
      coordinateSystem: "cartesian",
    }

    if (this.input) {
      const inputViz = visualizeInputProblem(this.input.inputProblem)
      graphics.lines!.push(...(inputViz.lines ?? []))
      graphics.points!.push(...(inputViz.points ?? []))
      graphics.rects!.push(...(inputViz.rects ?? []))
      graphics.circles!.push(...(inputViz.circles ?? []))
    }

    for (const trace of this.cleanedTraces) {
      const path = trace.tracePath
      for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i]
        const p2 = path[i + 1]
        if (!p1 || !p2) continue
        graphics.lines!.push({
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          strokeColor: "blue",
        } as unknown as Line)
      }
    }

    return graphics
  }
}
