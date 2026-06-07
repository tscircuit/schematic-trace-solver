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
  | "untangling_traces"
  | "minimizing_turns"
  | "balancing_l_shapes"
  | "merging_same_net_traces"

/**
 * The TraceCleanupSolver is responsible for improving the aesthetics and readability of schematic traces.
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
    const netGroups = new Map<string, SolvedTracePath[]>()

    for (const trace of this.outputTraces) {
      if (!trace.mspPairId) continue

      // Use mergedLabelNetIdMap to correctly group traces by net instead
      // of splitting on '_', which is fragile and produces wrong keys for IDs
      // like "net_GND_to_net_VCC" (split would yield "net" for every trace).
      let baseNetId: string | undefined
      for (const [netId, pairIds] of Object.entries(
        this.input.mergedLabelNetIdMap,
      )) {
        if (pairIds.has(trace.mspPairId)) {
          baseNetId = netId
          break
        }
      }
      // Fall back to the full mspPairId if no net mapping is found
      if (!baseNetId) baseNetId = trace.mspPairId

      if (!netGroups.has(baseNetId)) {
        netGroups.set(baseNetId, [])
      }
      netGroups.get(baseNetId)!.push(trace)
    }

    const SNAP_THRESHOLD = 0.15

    for (const [_, netTraces] of netGroups.entries()) {
      for (let i = 0; i < netTraces.length; i++) {
        for (let j = i + 1; j < netTraces.length; j++) {
          const traceA = netTraces[i]
          const traceB = netTraces[j]

          for (const pointA of traceA.tracePath) {
            for (const pointB of traceB.tracePath) {
              if (
                Math.abs(pointA.y - pointB.y) > 0 &&
                Math.abs(pointA.y - pointB.y) <= SNAP_THRESHOLD
              ) {
                pointB.y = pointA.y
              }
              if (
                Math.abs(pointA.x - pointB.x) > 0 &&
                Math.abs(pointA.x - pointB.x) <= SNAP_THRESHOLD
              ) {
                pointB.x = pointA.x
              }
            }
          }
        }
      }
    }

    // Fix: was `for (const trace of traces)` — `traces` was never declared.
    // The correct reference is `this.outputTraces`.
    for (const trace of this.outputTraces) {
      const cleanPath = []
      for (const p of trace.tracePath) {
        if (cleanPath.length === 0) {
          cleanPath.push(p)
        } else {
          const last = cleanPath[cleanPath.length - 1]
          if (
            !(Math.abs(last.x - p.x) < 0.001 && Math.abs(last.y - p.y) < 0.001)
          ) {
            cleanPath.push(p)
          }
        }
      }
      trace.tracePath = cleanPath
    }

    this.tracesMap = new Map(this.outputTraces.map((t) => [t.mspPairId, t]))
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
        strokeColor: trace.mspPairId === this.activeTraceId ? "red" : "blue",
      }
      graphics.lines!.push(line)
    }
    return graphics
  }
}