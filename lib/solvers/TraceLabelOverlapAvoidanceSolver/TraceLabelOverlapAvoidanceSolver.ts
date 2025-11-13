import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "../../types/InputProblem"
import { MergedNetLabelObstacleSolver } from "./sub-solvers/LabelMergingSolver/LabelMergingSolver"
import { getColorFromString } from "lib/utils/getColorFromString"
import { OverlapAvoidanceStepSolver } from "./sub-solvers/OverlapAvoidanceStepSolver/OverlapAvoidanceStepSolver"
import { detectTraceLabelOverlap } from "./detectTraceLabelOverlap"

interface TraceLabelOverlapAvoidanceSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

/**
 * Resolves overlaps between schematic traces and net labels using a two-phase,
 * "fire-and-forget" dispatching strategy.
 *
 * This solver operates in two distinct phases:
 *
 * 1.  **Dispatch Phase**: Iterates through traces, identifying clean ones and dispatching
 *     colliding ones to dedicated `OverlapAvoidanceStepSolver` instances.
 *
 * 2.  **Execution Phase**: Steps through all dispatched sub-solvers until they complete.
 *
 * The final output combines clean traces with results from sub-solvers. A final
 * `MergedNetLabelObstacleSolver` ensures pipeline compatibility.
 */
export class TraceLabelOverlapAvoidanceSolver extends BaseSolver {
  inputProblem: InputProblem
  netLabelPlacements: NetLabelPlacement[]

  unprocessedTraces: SolvedTracePath[] = []
  cleanTraces: SolvedTracePath[] = []
  subSolvers: OverlapAvoidanceStepSolver[] = []
  private phase: "searching_for_overlaps" | "fixing_overlaps" =
    "searching_for_overlaps"
  detourCounts: Map<string, number> = new Map()

  labelMergingSolver?: MergedNetLabelObstacleSolver

  constructor(solverInput: TraceLabelOverlapAvoidanceSolverInput) {
    super()
    this.inputProblem = solverInput.inputProblem
    this.unprocessedTraces = [...solverInput.traces]
    this.netLabelPlacements = solverInput.netLabelPlacements
    this.cleanTraces = []
    this.subSolvers = []
  }

  override _step() {
    if (this.phase === "searching_for_overlaps") {
      if (this.unprocessedTraces.length === 0) {
        console.log(
          `Dispatch phase complete. Created ${this.subSolvers.length} sub-solvers.`,
        )
        this.phase = "fixing_overlaps"
        return
      }

      const currentTargetTrace = this.unprocessedTraces.shift()!

      const localOverlaps = detectTraceLabelOverlap({
        traces: [currentTargetTrace],
        netLabels: this.netLabelPlacements,
      })

      if (localOverlaps.length === 0) {
        this.cleanTraces.push(currentTargetTrace)
      } else {
        // Dispatch a new sub-solver for this dirty trace
        const collidingLabels = localOverlaps.map((o) => o.label)
        const labelMerger = new MergedNetLabelObstacleSolver({
          netLabelPlacements: collidingLabels,
          inputProblem: this.inputProblem,
          traces: [currentTargetTrace],
        })
        labelMerger.solve()
        const mergingOutput = labelMerger.getOutput()

        const subSolver = new OverlapAvoidanceStepSolver({
          inputProblem: this.inputProblem,
          traces: [currentTargetTrace],
          initialNetLabelPlacements: this.netLabelPlacements,
          mergedNetLabelPlacements: mergingOutput.netLabelPlacements,
          mergedLabelNetIdMap: mergingOutput.mergedLabelNetIdMap,
          detourCounts: this.detourCounts,
        })
        this.subSolvers.push(subSolver)
      }
    } else if (this.phase === "fixing_overlaps") {
      if (this.subSolvers.every((s) => s.solved || s.failed)) {
        console.log("All sub-solvers finished.")
        // Final merge for pipeline compatibility
        if (!this.labelMergingSolver) {
          this.labelMergingSolver = new MergedNetLabelObstacleSolver({
            netLabelPlacements: this.netLabelPlacements,
            inputProblem: this.inputProblem,
            traces: this.getOutput().traces,
          })
          this.labelMergingSolver.solve()
        }
        this.solved = true
        return
      }

      // Step through all active sub-solvers
      for (const solver of this.subSolvers) {
        if (!solver.solved && !solver.failed) {
          solver.step()
        }
      }
    }
  }

  getOutput() {
    const solvedTraces = this.subSolvers.flatMap((s) => s.getOutput().allTraces)
    return {
      traces: [...this.cleanTraces, ...solvedTraces],
      netLabelPlacements:
        this.labelMergingSolver?.getOutput().netLabelPlacements ??
        this.netLabelPlacements,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)
    if (!graphics.lines) graphics.lines = []
    if (!graphics.rects) graphics.rects = []

    // Show clean traces in purple
    for (const trace of this.cleanTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    // Delegate visualization to sub-solvers
    for (const solver of this.subSolvers) {
      const solverGraphics = solver.visualize()
      graphics.lines!.push(...(solverGraphics.lines ?? []))
      graphics.rects!.push(...(solverGraphics.rects ?? []))
      // graphics.texts!.push(...(solverGraphics.texts ?? []))
      graphics.points!.push(...(solverGraphics.points ?? []))
    }

    // Also show original labels
    for (const label of this.netLabelPlacements) {
      const color = getColorFromString(label.globalConnNetId, 0.3) // Make fill opaque
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
