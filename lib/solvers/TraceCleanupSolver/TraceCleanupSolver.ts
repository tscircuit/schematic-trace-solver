import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import { simplifyPath } from "./simplifyPath"
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
  | "balancing_l_shapes"
  | "untangling_traces"
  | "merging_traces"

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
  private pipelineStep: PipelineStep = "merging_traces"
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
      case "merging_traces":
        this._runMergeTracesStep()
        break
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

  private _runMergeTracesStep() {
    let mergedAny = false
    const traces = [...this.outputTraces]
    const newTraces: SolvedTracePath[] = []
    const processedIndices = new Set<number>()

    for (let i = 0; i < traces.length; i++) {
      if (processedIndices.has(i)) continue
      let currentTrace = traces[i]!
      processedIndices.add(i)

      let mergedThisRound = true
      while (mergedThisRound) {
        mergedThisRound = false
        for (let j = 0; j < traces.length; j++) {
          if (processedIndices.has(j)) continue
          const otherTrace = traces[j]!

          if (currentTrace.globalConnNetId !== otherTrace.globalConnNetId) continue

          // Check if they can be merged
          const p1Start = currentTrace.tracePath[0]!
          const p1End = currentTrace.tracePath[currentTrace.tracePath.length - 1]!
          const p2Start = otherTrace.tracePath[0]!
          const p2End = otherTrace.tracePath[otherTrace.tracePath.length - 1]!

          const dist = (pt1: any, pt2: any) => Math.sqrt((pt1.x - pt2.x) ** 2 + (pt1.y - pt2.y) ** 2)
          const threshold = 0.05 // Standard threshold

          let mergedPath: any[] | null = null
          if (dist(p1End, p2Start) < threshold) {
            mergedPath = [...currentTrace.tracePath, ...otherTrace.tracePath]
          } else if (dist(p1Start, p2End) < threshold) {
            mergedPath = [...otherTrace.tracePath, ...currentTrace.tracePath]
          } else if (dist(p1End, p2End) < threshold) {
            mergedPath = [...currentTrace.tracePath, ...[...otherTrace.tracePath].reverse()]
          } else if (dist(p1Start, p2Start) < threshold) {
            mergedPath = [...[...currentTrace.tracePath].reverse(), ...otherTrace.tracePath]
          }

          if (mergedPath) {
            currentTrace = {
              ...currentTrace,
              tracePath: simplifyPath(mergedPath),
              mspConnectionPairIds: [
                ...currentTrace.mspConnectionPairIds,
                ...otherTrace.mspConnectionPairIds,
              ],
              pinIds: [...currentTrace.pinIds, ...otherTrace.pinIds],
            }
            processedIndices.add(j)
            mergedThisRound = true
            mergedAny = true
          }
        }
      }
      newTraces.push(currentTrace)
    }

    this.outputTraces = newTraces
    this.tracesMap = new Map(this.outputTraces.map((t) => [t.mspPairId, t]))
    this.traceIdQueue = Array.from(this.tracesMap.keys())
    this.pipelineStep = "untangling_traces"
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
        this.outputTraces.map((e) => e.mspPairId),
      )
      return
    }

    this._processTrace("minimizing_turns")
  }

  private _runBalanceLShapesStep() {
    if (this.traceIdQueue.length === 0) {
      this.solved = true
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
