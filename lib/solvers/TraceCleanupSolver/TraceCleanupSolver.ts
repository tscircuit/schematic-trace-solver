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
import { snapPath } from "./snapPath"
import { simplifyPath } from "./simplifyPath"

/**
 * Represents the different stages or steps within the trace cleanup pipeline.
 */
type PipelineStep =
  | "untangling_traces"
  | "snapping_traces"
  | "minimizing_turns"
  | "balancing_l_shapes"
  | "merging_same_net_traces"

/**
 * The TraceCleanupSolver is responsible for improving the aesthetics and readability of schematic traces.
 * It operates in a multi-step pipeline:
 * 1. **Untangling Traces**: It first attempts to untangle any overlapping or highly convoluted traces using a sub-solver.
 * 2. **Snapping Traces**: It snaps trace segments that are close together to the same X or Y coordinate.
 * 3. **Minimizing Turns**: After untangling, it iterates through each trace to minimize the number of turns, simplifying their paths.
 * 4. **Balancing L-Shapes**: Finally, it balances L-shaped trace segments to create more visually appealing and consistent layouts.
 * 5. **Merging Same-Net Traces**: It merges separate trace paths belonging to the same net that share endpoints.
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
        this.pipelineStep = "snapping_traces"
      } else if (this.activeSubSolver.failed) {
        this.activeSubSolver = null
        this.pipelineStep = "snapping_traces"
      }
      return
    }

    switch (this.pipelineStep) {
      case "untangling_traces":
        this._runUntangleTracesStep()
        break
      case "snapping_traces":
        this._runSnapTracesStep()
        break
      case "minimizing_turns":
        this._runMinimizeTurnsStep()
        break
      case "balancing_l_shapes":
        this._runBalanceLShapesStep()
        break
      case "merging_same_net_traces":
        this._runMergeSameNetTracesStep()
        break
    }
  }

  private _runUntangleTracesStep() {
    this.activeSubSolver = new UntangleTraceSubsolver({
      ...this.input,
      allTraces: Array.from(this.tracesMap.values()),
    })
  }

  private _runSnapTracesStep() {
    for (const trace of this.outputTraces) {
      trace.tracePath = simplifyPath(snapPath(trace.tracePath))
    }
    this.pipelineStep = "minimizing_turns"
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
      this.pipelineStep = "merging_same_net_traces"
      return
    }

    this._processTrace("balancing_l_shapes")
  }

  private _runMergeSameNetTracesStep() {
    const tracesByNet: Record<string, SolvedTracePath[]> = {}
    for (const trace of this.outputTraces) {
      const netId = trace.globalConnNetId
      if (!tracesByNet[netId]) tracesByNet[netId] = []
      tracesByNet[netId].push(trace)
    }

    const newTraces: SolvedTracePath[] = []
    for (const netId in tracesByNet) {
      const netTraces = tracesByNet[netId]
      newTraces.push(...this._mergeTracesInNet(netTraces))
    }
    this.outputTraces = newTraces
    this.solved = true
  }

  private _mergeTracesInNet(
    netTraces: SolvedTracePath[],
  ): SolvedTracePath[] {
    if (netTraces.length <= 1) return netTraces

    let merged = true
    const currentTraces = [...netTraces]

    while (merged) {
      merged = false
      for (let i = 0; i < currentTraces.length; i++) {
        for (let j = i + 1; j < currentTraces.length; j++) {
          const t1 = currentTraces[i]
          const t2 = currentTraces[j]

          const p1Start = t1.tracePath[0]
          const p1End = t1.tracePath[t1.tracePath.length - 1]
          const p2Start = t2.tracePath[0]
          const p2End = t2.tracePath[t2.tracePath.length - 1]

          let newPath: any[] | null = null
          if (p1End.x === p2Start.x && p1End.y === p2Start.y) {
            newPath = [...t1.tracePath, ...t2.tracePath.slice(1)]
          } else if (p1End.x === p2End.x && p1End.y === p2End.y) {
            newPath = [...t1.tracePath, ...[...t2.tracePath].reverse().slice(1)]
          } else if (p1Start.x === p2Start.x && p1Start.y === p2Start.y) {
            newPath = [
              ...[...t1.tracePath].reverse(),
              ...t2.tracePath.slice(1),
            ]
          } else if (p1Start.x === p2End.x && p1Start.y === p2End.y) {
            newPath = [...t2.tracePath, ...t1.tracePath.slice(1)]
          }

          if (newPath) {
            const newTrace: SolvedTracePath = {
              ...t1,
              tracePath: simplifyPath(newPath),
              mspConnectionPairIds: [
                ...t1.mspConnectionPairIds,
                ...t2.mspConnectionPairIds,
              ],
              pinIds: Array.from(new Set([...t1.pinIds, ...t2.pinIds])),
            }
            currentTraces.splice(j, 1)
            currentTraces[i] = newTrace
            merged = true
            break
          }
        }
        if (merged) break
      }
    }
    return currentTraces
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
