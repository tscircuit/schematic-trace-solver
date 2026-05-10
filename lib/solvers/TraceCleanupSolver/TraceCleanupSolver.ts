import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import { minimizeTurnsWithFilteredLabels } from "./minimizeTurnsWithFilteredLabels"
import { balanceZShapes } from "./balanceZShapes"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { is4PointRectangle } from "./is4PointRectangle"

function mergeSameNetCloseTraces(
  traces: SolvedTracePath[],
  mergedLabelNetIdMap: Record<string, Set<string>>,
): SolvedTracePath[] {
  const SNAP_THRESHOLD = 0.15

  // Map each trace to a net group using mergedLabelNetIdMap
  const traceToNetGroup = new Map<string, string>()
  for (const trace of traces) {
    let grouped = false
    for (const [labelId, netIds] of Object.entries(mergedLabelNetIdMap)) {
      for (const netId of netIds) {
        if (trace.mspPairId.includes(netId)) {
          traceToNetGroup.set(trace.mspPairId, labelId)
          grouped = true
          break
        }
      }
      if (grouped) break
    }
    if (!grouped) traceToNetGroup.set(trace.mspPairId, trace.mspPairId)
  }

  // Group traces by net
  const netGroups = new Map<string, SolvedTracePath[]>()
  for (const trace of traces) {
    const groupKey = traceToNetGroup.get(trace.mspPairId)!
    if (!netGroups.has(groupKey)) netGroups.set(groupKey, [])
    netGroups.get(groupKey)!.push(trace)
  }

  // Copy all trace paths as mutable
  const updatedPaths = new Map<string, Array<{ x: number; y: number }>>(
    traces.map((t) => [
      t.mspPairId,
      t.tracePath.map((p) => ({ x: p.x, y: p.y })),
    ]),
  )

  for (const [, group] of netGroups) {
    if (group.length < 2) continue

    for (let ai = 0; ai < group.length; ai++) {
      const traceA = group[ai]
      const pathA = updatedPaths.get(traceA.mspPairId)!
      for (let pi = 1; pi < pathA.length - 1; pi++) {
        for (let bi = ai + 1; bi < group.length; bi++) {
          const traceB = group[bi]
          const pathB = updatedPaths.get(traceB.mspPairId)!
          for (let pj = 1; pj < pathB.length - 1; pj++) {
            const dy = Math.abs(pathA[pi].y - pathB[pj].y)
            const dx = Math.abs(pathA[pi].x - pathB[pj].x)

            // Snap close Y values (horizontal alignment)
            if (dy > 0 && dy < SNAP_THRESHOLD) {
              const avg = (pathA[pi].y + pathB[pj].y) / 2
              pathA[pi] = { ...pathA[pi], y: avg }
              pathB[pj] = { ...pathB[pj], y: avg }
            }

            // Snap close X values (vertical alignment)
            if (dx > 0 && dx < SNAP_THRESHOLD) {
              const avg = (pathA[pi].x + pathB[pj].x) / 2
              pathA[pi] = { ...pathA[pi], x: avg }
              pathB[pj] = { ...pathB[pj], x: avg }
            }
          }
        }
      }
    }
  }

  return traces.map((t) => ({
    ...t,
    tracePath: updatedPaths.get(t.mspPairId)!,
  }))
}
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


/**
 * Represents the different stages or steps within the trace cleanup pipeline.
 */
type PipelineStep =
  | "minimizing_turns"
  | "balancing_l_shapes"
  | "untangling_traces"
  | "merging_same_net_traces"

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
    this.outputTraces = mergeSameNetCloseTraces(
      this.outputTraces,
      this.input.mergedLabelNetIdMap,
    )
    this.solved = true
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
