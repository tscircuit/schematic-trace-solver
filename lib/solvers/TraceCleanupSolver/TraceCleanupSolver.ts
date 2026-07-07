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
  | "merge_close_same_net_segments"
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
        this.pipelineStep = "merge_close_same_net_segments"
      } else if (this.activeSubSolver.failed) {
        this.activeSubSolver = null
        this.pipelineStep = "merge_close_same_net_segments"
      }
      return
    }

    switch (this.pipelineStep) {
      case "untangling_traces":
        this._runUntangleTracesStep()
        break
      case "merge_close_same_net_segments":
        this._runMergeCloseSameNetSegmentsStep()
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

  private _runMergeCloseSameNetSegmentsStep() {
    this.outputTraces = mergeCloseSameNetSegments(this.outputTraces)
    this.tracesMap = new Map(this.outputTraces.map((t) => [t.mspPairId, t]))
    this.traceIdQueue = Array.from(this.outputTraces.map((e) => e.mspPairId))
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
      this.solved = true
      return
    }

    this._processTrace("balancing_l_shapes")
  }

  private _processTrace(step: "minimizing_turns" | "balancing_l_shapes") {
    const targetMspConnectionPairId = this.traceIdQueue.shift()!
    this.activeTraceId = targetMspConnectionPairId
    const originalTrace = this.tracesMap.get(targetMspConnectionPairId)
    if (!originalTrace) return

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

const MERGE_DISTANCE = 0.12
const EPS = 1e-6

function mergeCloseSameNetSegments(
  traces: SolvedTracePath[],
): SolvedTracePath[] {
  const result = [...traces]
  let changed = true

  while (changed) {
    changed = false
    outer: for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const merged = tryMergeTracePair(result[i]!, result[j]!)
        if (!merged) continue

        result.splice(j, 1)
        result[i] = merged
        changed = true
        break outer
      }
    }
  }

  return result
}

function tryMergeTracePair(
  a: SolvedTracePath,
  b: SolvedTracePath,
): SolvedTracePath | null {
  if (a.globalConnNetId !== b.globalConnNetId) return null

  const ap = [...a.tracePath]
  const bp = [...b.tracePath]
  const candidates = [
    { da: ap.at(-1)!, db: bp[0]!, path: [...ap, ...bp] },
    { da: ap[0]!, db: bp.at(-1)!, path: [...bp, ...ap] },
    { da: ap[0]!, db: bp[0]!, path: [...ap.reverse(), ...bp] },
    { da: ap.at(-1)!, db: bp.at(-1)!, path: [...ap, ...bp.reverse()] },
  ]

  for (const candidate of candidates) {
    const splitIndex = candidate.path.findIndex(
      (point) => point.x === candidate.db.x && point.y === candidate.db.y,
    )
    const bridge = getOrthogonalBridgeIfClose(candidate.da, candidate.db)
    if (!bridge || splitIndex === -1) continue

    const path = simplifyConsecutiveDuplicates([
      ...candidate.path.slice(0, splitIndex),
      ...bridge,
      ...candidate.path.slice(splitIndex),
    ])

    return {
      ...a,
      tracePath: path,
      mspConnectionPairIds: [
        ...a.mspConnectionPairIds,
        ...b.mspConnectionPairIds,
      ],
      pinIds: [...a.pinIds, ...b.pinIds],
    }
  }

  return null
}

function getOrthogonalBridgeIfClose(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  if (Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= MERGE_DISTANCE) {
    return [{ x: a.x, y: b.y }]
  }
  if (Math.abs(a.y - b.y) <= EPS && Math.abs(a.x - b.x) <= MERGE_DISTANCE) {
    return [{ x: b.x, y: a.y }]
  }
  return null
}

function simplifyConsecutiveDuplicates(path: Array<{ x: number; y: number }>) {
  return path.filter((point, index) => {
    const prev = path[index - 1]
    return (
      !prev ||
      Math.abs(prev.x - point.x) > EPS ||
      Math.abs(prev.y - point.y) > EPS
    )
  })
}
