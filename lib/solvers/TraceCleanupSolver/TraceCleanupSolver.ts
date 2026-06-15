import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import { minimizeTurnsWithFilteredLabels } from "./minimizeTurnsWithFilteredLabels"
import { balanceZShapes } from "./balanceZShapes"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"

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

/**
 * The TraceCleanupSolver is responsible for improving the aesthetics and readability of schematic traces.
 * It operates in a multi-step pipeline:
 * 1. **Untangling Traces**: It first attempts to untangle any overlapping or highly convoluted traces using a sub-solver.
 * 2. **Minimizing Turns**: After untangling, it iterates through each trace to minimize the number of turns, simplifying their paths.
 * 3. **Balancing L-Shapes**: Finally, it balances L-shaped trace segments to create more visually appealing and consistent layouts.
 * The solver processes traces one by one, applying these cleanup steps sequentially to refine the overall trace layout.
 */
export class TraceCleanupSolver extends BaseSolver {
  private input: TraceCleanupSolverInput
  private outputTraces: SolvedTracePath[]
  private traceIdQueue: string[]
  private tracesMap: Map<string, SolvedTracePath>
  private pipelineStep: PipelineStep = "untangling_traces"
  private activeTraceId: string | null = null // New property
  override activeSubSolver: BaseSolver | null = null

  constructor(solverInput: TraceCleanupSolverInput) {
    super()
    this.input = solverInput
    this.outputTraces = [...solverInput.allTraces]
    this.tracesMap = new Map(this.outputTraces.map((t) => [t.mspPairId, t]))
    this.traceIdQueue = Array.from(
      solverInput.allTraces.map((e) => e.mspPairId),
    )
  }

  override _step() {
    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      if (this.activeSubSolver.solved) {
        const output = (
          this.activeSubSolver as UntangleTraceSubsolver
        ).getOutput()
        this.outputTraces = output.traces
        this.tracesMap = new Map(this.outputTraces.map((t) => [t.mspPairId, t]))
        this.activeSubSolver = null
        this.pipelineStep = "minimizing_turns"
      } else if (this.activeSubSolver.failed) {
        this.activeSubSolver = null
        this.pipelineStep = "minimizing_turns"
      }
      return
    }

    switch (this.pipelineStep) {
      case "untangling_traces":
        this._runUntangleTracesStep()
        break
      case "minimizing_turns":
        this._runMinimizeTurnsStep()
        break
      case "balancing_l_shapes":
        this._runBalanceLShapesStep()
        break
    }
  }

  private _runUntangleTracesStep() {
    this.activeSubSolver = new UntangleTraceSubsolver({
      ...this.input,
      allTraces: Array.from(this.tracesMap.values()),
    })
  }

  private _runMinimizeTurnsStep() {
    if (this.traceIdQueue.length === 0) {
      this.pipelineStep = "balancing_l_shapes"
      this.traceIdQueue = Array.from(
        this.input.allTraces.map((e) => e.mspPairId),
      )
      return
    }

    this._processTrace("minimizing_turns")
  }

  private _runBalanceLShapesStep() {
    if (this.traceIdQueue.length === 0) {
      // Execute the Advanced Collinear Same-Net Trace Merging Pass
      this._mergeCloseSameNetTraces()
      this.solved = true
      return
    }

    this._processTrace("balancing_l_shapes")
  }

  /**
   * Scans and snaps nearby horizontal and vertical same-net trace segments
   * and repairs connected adjacent trace joints to avoid trace breakages.
   */
  private _mergeCloseSameNetTraces() {
    const maxSnapDistance = 0.05 // Align within geometric padding thresholds

    for (const trace of this.outputTraces) {
      const currentNet = trace.globalConnNetId
      const path = trace.tracePath

      // Iterate through internal segments to avoid breaking core pin terminals
      for (let i = 1; i < path.length - 2; i++) {
        const p1 = path[i]
        const p2 = path[i + 1]

        // Handle Horizontal Line Alignment Pass
        if (p1.y === p2.y) {
          for (const sibling of this.outputTraces) {
            if (sibling.globalConnNetId !== currentNet) continue

            for (let j = 0; j < sibling.tracePath.length - 1; j++) {
              const s1 = sibling.tracePath[j]
              const s2 = sibling.tracePath[j + 1]

              if (s1.y === s2.y && Math.abs(p1.y - s1.y) <= maxSnapDistance && p1.y !== s1.y) {
                const targetY = s1.y
                
                // Align current segment
                p1.y = targetY
                p2.y = targetY
                
                // Keep connected lines intact by stretching the neighboring elbow joint elements
                if (path[i - 1]) path[i - 1].y = targetY
                if (path[i + 2]) path[i + 2].y = targetY
                break
              }
            }
          }
        }
        // Handle Vertical Line Alignment Pass
        else if (p1.x === p2.x) {
          for (const sibling of this.outputTraces) {
            if (sibling.globalConnNetId !== currentNet) continue

            for (let j = 0; j < sibling.tracePath.length - 1; j++) {
              const s1 = sibling.tracePath[j]
              const s2 = sibling.tracePath[j + 1]

              if (s1.x === s2.x && Math.abs(p1.x - s1.x) <= maxSnapDistance && p1.x !== s1.x) {
                const targetX = s1.x
                
                // Align current segment
                p1.x = targetX
                p2.x = targetX
                
                // Keep connected lines intact by stretching the neighboring elbow joint elements
                if (path[i - 1]) path[i - 1].x = targetX
                if (path[i + 2]) path[i + 2].x = targetX
                break
              }
            }
          }
        }
      }
    }
    
    // Remap current state updates to memory map caches
    this.tracesMap = new Map(this.outputTraces.map((t) => [t.mspPairId, t]))
  }

  private _processTrace(step: "minimizing_turns" | "balancing_l_shapes") {
    const targetMspConnectionPairId = this.traceIdQueue.shift()!
    this.activeTraceId = targetMspConnectionPairId
    const originalTrace = this.tracesMap.get(targetMspConnectionPairId)!

    if (is4PointRectangle(originalTrace.tracePath)) {
      return
    }

    const allTraces = Array.from(this.tracesMap.values())

    let updatedTrace: SolvedTracePath

    if (step === "minimizing_turns") {
      updatedTrace = minimizeTurnsWithFilteredLabels({
        ...this.input,
        targetMspConnectionPairId,
        traces: allTraces,
      })
    } else {
      updatedTrace = balanceZShapes({
        ...this.input,
        targetMspConnectionPairId,
        traces: allTraces,
      })
    }

    this.tracesMap.set(targetMspConnectionPairId, updatedTrace)
    this.outputTraces = Array.from(this.tracesMap.values())
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    if (this.activeSubSolver) {
      return this.activeSubSolver.visualize()
    }

    const graphics = visualizeInputProblem(this.input.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    if (!graphics.lines) graphics.lines = []
    if (!graphics.points) graphics.points = []
    if (!graphics.rects) graphics.rects = []
    if (!graphics.circles) graphics.circles = []
    if (!graphics.texts) graphics.texts = []

    for (const trace of this.outputTraces) {
      const line: Line = {
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: trace.mspPairId === this.activeTraceId ? "red" : "blue", // Highlight active trace
      }
      graphics.lines!.push(line)
    }
    return graphics
  }
}
