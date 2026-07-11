import { snapSameNetTraces } from "./snapSameNetTraces"
import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import { minimizeTurnsWithFilteredLabels } from "./minimizeTurnsWithFilteredLabels"
import { balanceZShapes } from "./balanceZShapes"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { UntangleTraceSubSolver } from "./sub-solver/UntangleTraceSubSolver"
import { is4PointRectangle } from "./is4PointRectangle"

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

/**
 * Represents the different stages or steps within the trace cleanup pipeline.
 */
type PipelineStep =
  | "untangling_traces"
  | "minimizing_turns"
  | "balancing_l_shapes"
  | "snapping_same_net"

/**
 * The TraceCleanupSolver is responsible for improving the aesthetics and readability of schematic traces.
 * It operates in a multi-step pipeline:
 * 1. **Untangling Traces**: It first attempts to untangle any overlapping or highly convoluted traces using a sub-solver.
 * 2. **Minimizing Turns**: After untangling, it iterates through each trace to minimize the number of turns, simplifying their paths.
 * 3. **Balancing L-Shapes**: It balances L-shaped trace segments to create more visually appealing and consistent layouts.
 * 4. **Snapping Same-Net Traces**: Finally, parallel segments that belong to the same net and are very close together are snapped to the exact same X (vertical) or Y (horizontal) coordinate, eliminating near-coincident trace lines.
 * The solver processes traces one by one, applying these cleanup steps sequentially to refine the overall trace layout.
 */
export class TraceCleanupSolver extends BaseSolver {
  private input: TraceCleanupSolverInput
  private outputTraces: SolvedTracePath[]
  private traceIdQueue: string[]
  private tracesMap: Map<string, SolvedTracePath>
  private pipelineStep: PipelineStep = "untangling_traces"
  private activeTraceId: string | null = null
  override activeSubSolver: BaseSolver | null = null

  constructor(solverInput: TraceCleanupSolverInput) {
    super()
    this.input = solverInput
    this.outputTraces = [...solverInput.allTraces]
    this.tracesMap = new Map(this.outputTraces.map((t) => [t.mspPairId(), t]))
    this.traceIdQueue = Array.from(
      solverInput.allTraces.map((t) => t.mspPairId()),
    )
  }

  override _step() {
    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      if (this.activeSubSolver.solved) {
        const output = (
          this.activeSubSolver as UntangleTraceSubSolver
        ).getOutput()
        this.outputTraces = output.traces
        this.tracesMap = new Map(this.outputTraces.map((t) => [t.mspPairId(), t]))
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
        this._runUntangleStep()
        break
      case "minimizing_turns":
        this._runMinimizeTurnsStep()
        break
      case "balancing_l_shapes":
        this._runBalanceLShapesStep()
        break
      case "snapping_same_net":
        this._runSnapSameNetStep()
        break
    }
  }

  private _runUntangleStep() {
    const problem = this.input.inputProblem
    this.activeSubSolver = new UntangleTraceSubSolver({
      inputProblem: problem,
      traces: this.outputTraces,
    })
  }

  private _runMinimizeTurnsStep() {
    if (this.traceIdQueue.length === 0) {
      this.traceIdQueue = Array.from(this.tracesMap.keys())
      this.pipelineStep = "balancing_l_shapes"
      return
    }

    const traceId = this.traceIdQueue.shift()!
    const trace = this.tracesMap.get(traceId)!
    const newTrace = minimizeTurnsWithFilteredLabels(trace, this.input)
    this.tracesMap.set(traceId, newTrace)
  }

  private _runBalanceLShapesStep() {
    if (this.traceIdQueue.length === 0) {
      this.traceIdQueue = Array.from(this.tracesMap.keys())
      this.pipelineStep = "snapping_same_net"
      return
    }

    const traceId = this.traceIdQueue.shift()!
    const trace = this.tracesMap.get(traceId)!
    const newTrace = balanceZShapes(trace, this.input)
    this.tracesMap.set(traceId, newTrace)
  }

  private _runSnapSameNetStep() {
    const traces = Array.from(this.tracesMap.values())
    const snapped = snapSameNetTraces(traces)

    for (const trace of snapped) {
      this.tracesMap.set(trace.mspPairId(), trace)
    }

    this.outputTraces = Array.from(this.tracesMap.values())
    this.solved = true
  }

  override getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    return visualizeInputProblem(this.input.inputProblem)
  }
}
