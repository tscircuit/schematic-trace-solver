import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import { minimizeTurnsWithFilteredLabels } from "./minimizeTurnsWithFilteredLabels"
import { balanceZShapes } from "./balanceZShapes"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { alignSameNetRails } from "./alignSameNetRails"
import { UntangleTraceSubsolver } from "./sub-solver/UntangleTraceSubsolver"
import { is4PointRectangle } from "./is4PointRectangle"

/**
 * Represents the different stages or steps within the trace cleanup pipeline.
 */
export type PipelineStep =
  | "untangling_traces"
  | "minimizing_turns"
  | "merge_same_net_traces"
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
  operations?: readonly PipelineStep[]
  eligibleTraceIds?: ReadonlySet<string>
}

const DEFAULT_OPERATIONS: readonly PipelineStep[] = [
  "untangling_traces",
  "minimizing_turns",
  "balancing_l_shapes",
  "aligning_same_net_rails",
]

export class TraceCleanupSolver extends BaseSolver {
  private input: TraceCleanupSolverInput
  private outputTraces: SolvedTracePath[]
  private traceIdQueue: string[]
  private tracesMap: Map<string, SolvedTracePath>
  private operations: readonly PipelineStep[]
  private operationIndex = 0
  private pipelineStep: PipelineStep | null = "untangling_traces"
  private activeTraceId: string | null = null
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
      case "merge_same_net_traces":
        if (this.input.operations?.includes("merge_same_net_traces")) {
          this._runMergeSameNetTracesStep()
        } else {
          this._advancePipeline()
        }
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

  private _runMergeSameNetTracesStep() {
    const threshold = this.input.paddingBuffer || 0.5
    const traces = Array.from(this.tracesMap.values())

    for (let i = 0; i < traces.length; i++) {
      for (let j = i + 1; j < traces.length; j++) {
        const t1 = traces[i]
        const t2 = traces[j]

        const shareNet =
          t1.mspPairId === t2.mspPairId ||
          this.input.mergedLabelNetIdMap[t1.mspPairId]?.has(t2.mspPairId)

        if (shareNet) {
          for (const p1 of t1.tracePath) {
            for (const p2 of t2.tracePath) {
              if (Math.abs(p1.x - p2.x) < threshold) {
                p1.x = p2.x
              }
              if (Math.abs(p1.y - p2.y) < threshold) {
                p1.y = p2.y
              }
            }
          }
        }
      }
    }

    this.outputTraces = traces
    this.tracesMap = new Map(this.outputTraces.map((t) => [t.mspPairId, t]))
    this._advancePipeline()
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
    return { traces: this.outputTraces }
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
    for (const trace of this.outputTraces) {
      const line: Line = {
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: trace.mspPairId === this.activeTraceId ? "red" : "blue",
      }
      graphics.lines!.push(line)
    }
    return graphics
  }
}
