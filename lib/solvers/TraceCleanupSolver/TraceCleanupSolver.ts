import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import { minimizeTurnsWithFilteredLabels } from "./minimizeTurnsWithFilteredLabels"
import { balanceZShapes } from "./balanceZShapes"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { alignSameNetRails } from "./alignSameNetRails"

export type TraceCleanupOperation =
  | "untangling_traces"
  | "minimizing_turns"
  | "balancing_l_shapes"
  | "aligning_same_net_rails"

/**
 * Defines the input structure for the TraceCleanupSolver.
 */
export interface TraceCleanupSolverInput {
  inputProblem: InputProblem
  allTraces: SolvedTracePath[]
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
  operations?: readonly TraceCleanupOperation[]
  eligibleTraceIds?: ReadonlySet<string>
}

import { UntangleTraceSubsolver } from "./sub-solver/UntangleTraceSubsolver"
import { is4PointRectangle } from "./is4PointRectangle"

/**
 * Represents the different stages or steps within the trace cleanup pipeline.
 */
const DEFAULT_OPERATIONS: readonly TraceCleanupOperation[] = [
  "untangling_traces",
  "minimizing_turns",
  "balancing_l_shapes",
]

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
  private operations: readonly TraceCleanupOperation[]
  private operationIndex = 0
  private pipelineStep: TraceCleanupOperation | null
  private activeTraceId: string | null = null // New property
  override activeSubSolver: BaseSolver | null = null

  constructor(solverInput: TraceCleanupSolverInput) {
    super()
    this.input = solverInput
    this.outputTraces = [...solverInput.allTraces]
    this.tracesMap = new Map(this.outputTraces.map((t) => [t.mspPairId, t]))
    this.operations = solverInput.operations ?? DEFAULT_OPERATIONS
    this.pipelineStep = this.operations[0] ?? null
    this.traceIdQueue = Array.from(
      solverInput.allTraces.map((e) => e.mspPairId),
    )
  }

  reset() {
    this.outputTraces = [...this.input.allTraces]
    this.tracesMap = new Map(this.outputTraces.map((t) => [t.mspPairId, t]))
    this.traceIdQueue = Array.from(this.input.allTraces.map((e) => e.mspPairId))
    this.pipelineStep = "untangling_traces"
    this.activeTraceId = null
    this.activeSubSolver = null
    this.solved = false
    this.failed = false
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
        this._advancePipeline()
      } else if (this.activeSubSolver.failed) {
        this.activeSubSolver = null
        this._advancePipeline()
      }
      return
    }

    if (!this.pipelineStep) {
      this.solved = true
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
      case "aligning_same_net_rails":
        this._runAlignSameNetRailsStep()
        break
    }
  }

  private _advancePipeline() {
    this.operationIndex++
    this.pipelineStep = this.operations[this.operationIndex] ?? null
    this.traceIdQueue = this.outputTraces.map((trace) => trace.mspPairId)
    if (this.pipelineStep) this.activeTraceId = null
  }

  private _runUntangleTracesStep() {
    this.activeSubSolver = new UntangleTraceSubsolver({
      ...this.input,
      allTraces: Array.from(this.tracesMap.values()),
    })
  }

  private _runMinimizeTurnsStep() {
    if (this.traceIdQueue.length === 0) {
      this._advancePipeline()
      return
    }

    this._processTrace("minimizing_turns")
  }

  private _runBalanceLShapesStep() {
    if (this.traceIdQueue.length === 0) {
      this._advancePipeline()
      return
    }

    this._processTrace("balancing_l_shapes")
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

  private _runAlignSameNetRailsStep() {
    const alignment = alignSameNetRails({
      inputProblem: this.input.inputProblem,
      traces: this.outputTraces,
      netLabelPlacements: this.input.allLabelPlacements,
      eligibleTraceIds:
        this.input.eligibleTraceIds ??
        new Set(this.outputTraces.map((trace) => trace.mspPairId)),
    })
    this.outputTraces = alignment.traces
    this.tracesMap = new Map(this.outputTraces.map((t) => [t.mspPairId, t]))
    this.stats.alignedRailGroupCount = alignment.alignedRailGroupCount
    this.stats.alignedTraceCount = alignment.alignedTraceCount
    this._advancePipeline()
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
