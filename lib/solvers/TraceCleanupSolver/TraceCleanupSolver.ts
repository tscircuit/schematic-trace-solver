import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import { minimizeTurnsWithFilteredLabels } from "./minimizeTurnsWithFilteredLabels"
import { balanceZShapes } from "./balanceZShapes"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { simplifyPath } from "./simplifyPath"

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
  | "merging_same_net_traces"

/**
 * Represents a single segment extracted from a trace path, with indices back to the original path.
 */
interface TraceSegment {
  traceId: string
  segIndex: number
  x1: number
  y1: number
  x2: number
  y2: number
  orientation: "horizontal" | "vertical"
}

/**
 * Merge distance threshold for considering two parallel same-net segments as
 * candidates for merging.
 */
const MERGE_DISTANCE_THRESHOLD = 0.15

/**
 * Resolves the effective net id for a trace, taking into account merged label net ids.
 */
function getEffectiveNetId(
  trace: SolvedTracePath,
  mergedLabelNetIdMap: Record<string, Set<string>>,
): string {
  const netId = trace.globalConnNetId ?? trace.mspPairId
  for (const [key, set] of Object.entries(mergedLabelNetIdMap)) {
    if (set.has(netId)) return key
  }
  return netId
}

/**
 * Extract all horizontal and vertical segments from a trace path.
 */
function extractSegments(trace: SolvedTracePath): TraceSegment[] {
  const segments: TraceSegment[] = []
  const path = trace.tracePath
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]
    const p2 = path[i + 1]
    const dx = Math.abs(p1.x - p2.x)
    const dy = Math.abs(p1.y - p2.y)
    if (dy < 1e-9 && dx > 1e-9) {
      segments.push({
        traceId: trace.mspPairId,
        segIndex: i,
        x1: Math.min(p1.x, p2.x),
        y1: p1.y,
        x2: Math.max(p1.x, p2.x),
        y2: p1.y,
        orientation: "horizontal",
      })
    } else if (dx < 1e-9 && dy > 1e-9) {
      segments.push({
        traceId: trace.mspPairId,
        segIndex: i,
        x1: p1.x,
        y1: Math.min(p1.y, p2.y),
        x2: p1.x,
        y2: Math.max(p1.y, p2.y),
        orientation: "vertical",
      })
    }
  }
  return segments
}

/**
 * Check if two ranges [a1, a2] and [b1, b2] overlap (with some minimum overlap).
 */
function rangesOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
  const overlapStart = Math.max(a1, b1)
  const overlapEnd = Math.min(a2, b2)
  return overlapEnd - overlapStart > 1e-9
}

/**
 * Merge same-net traces that have parallel segments running close together.
 * For each group of traces sharing the same net, find parallel segments within
 * the merge threshold distance and snap them to a shared coordinate (average).
 */
function mergeSameNetTraces(
  traces: SolvedTracePath[],
  mergedLabelNetIdMap: Record<string, Set<string>>,
): SolvedTracePath[] {
  // Group traces by effective net id
  const netGroups = new Map<string, SolvedTracePath[]>()
  for (const trace of traces) {
    const netId = getEffectiveNetId(trace, mergedLabelNetIdMap)
    if (!netGroups.has(netId)) {
      netGroups.set(netId, [])
    }
    netGroups.get(netId)!.push(trace)
  }

  // Track which trace paths have been modified so we can simplify them
  const modifiedTraceIds = new Set<string>()

  // For each net group with more than one trace, look for mergeable segments
  for (const [_netId, group] of netGroups) {
    if (group.length < 2) continue

    // Extract all segments from all traces in this group
    const allSegments: TraceSegment[] = []
    for (const trace of group) {
      allSegments.push(...extractSegments(trace))
    }

    // Find pairs of segments from different traces that are parallel and close
    for (let i = 0; i < allSegments.length; i++) {
      for (let j = i + 1; j < allSegments.length; j++) {
        const segA = allSegments[i]
        const segB = allSegments[j]

        // Must be from different traces
        if (segA.traceId === segB.traceId) continue

        // Must have same orientation
        if (segA.orientation !== segB.orientation) continue

        if (segA.orientation === "horizontal") {
          // Both horizontal: check if Y coordinates are close
          const yDist = Math.abs(segA.y1 - segB.y1)
          if (yDist < 1e-9 || yDist > MERGE_DISTANCE_THRESHOLD) continue

          // Check if their X ranges overlap
          if (!rangesOverlap(segA.x1, segA.x2, segB.x1, segB.x2)) continue

          // Merge: snap both to the average Y
          const avgY = (segA.y1 + segB.y1) / 2

          // Update trace A path points
          const traceA = group.find((t) => t.mspPairId === segA.traceId)!
          traceA.tracePath[segA.segIndex].y = avgY
          traceA.tracePath[segA.segIndex + 1].y = avgY
          modifiedTraceIds.add(segA.traceId)

          // Update trace B path points
          const traceB = group.find((t) => t.mspPairId === segB.traceId)!
          traceB.tracePath[segB.segIndex].y = avgY
          traceB.tracePath[segB.segIndex + 1].y = avgY
          modifiedTraceIds.add(segB.traceId)

          // Update segment data for subsequent comparisons
          segA.y1 = avgY
          segA.y2 = avgY
          segB.y1 = avgY
          segB.y2 = avgY
        } else {
          // Both vertical: check if X coordinates are close
          const xDist = Math.abs(segA.x1 - segB.x1)
          if (xDist < 1e-9 || xDist > MERGE_DISTANCE_THRESHOLD) continue

          // Check if their Y ranges overlap
          if (!rangesOverlap(segA.y1, segA.y2, segB.y1, segB.y2)) continue

          // Merge: snap both to the average X
          const avgX = (segA.x1 + segB.x1) / 2

          // Update trace A path points
          const traceA = group.find((t) => t.mspPairId === segA.traceId)!
          traceA.tracePath[segA.segIndex].x = avgX
          traceA.tracePath[segA.segIndex + 1].x = avgX
          modifiedTraceIds.add(segA.traceId)

          // Update trace B path points
          const traceB = group.find((t) => t.mspPairId === segB.traceId)!
          traceB.tracePath[segB.segIndex].x = avgX
          traceB.tracePath[segB.segIndex + 1].x = avgX
          modifiedTraceIds.add(segB.traceId)

          // Update segment data for subsequent comparisons
          segA.x1 = avgX
          segA.x2 = avgX
          segB.x1 = avgX
          segB.x2 = avgX
        }
      }
    }
  }

  // Simplify modified traces to remove redundant collinear points
  const tracesMap = new Map(traces.map((t) => [t.mspPairId, t]))
  for (const traceId of modifiedTraceIds) {
    const trace = tracesMap.get(traceId)!
    trace.tracePath = simplifyPath(trace.tracePath)
  }

  return traces
}

/**
 * The TraceCleanupSolver is responsible for improving the aesthetics and readability of schematic traces.
 * It operates in a multi-step pipeline:
 * 1. **Untangling Traces**: It first attempts to untangle any overlapping or highly convoluted traces using a sub-solver.
 * 2. **Minimizing Turns**: After untangling, it iterates through each trace to minimize the number of turns, simplifying their paths.
 * 3. **Balancing L-Shapes**: Finally, it balances L-shaped trace segments to create more visually appealing and consistent layouts.
 * 4. **Merging Same-Net Traces**: Merges parallel segments from same-net traces that are very close together.
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
    const allTraces = Array.from(this.tracesMap.values())
    const mergedTraces = mergeSameNetTraces(
      allTraces,
      this.input.mergedLabelNetIdMap,
    )
    this.tracesMap = new Map(mergedTraces.map((t) => [t.mspPairId, t]))
    this.outputTraces = mergedTraces
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

  getOutputTraces(): SolvedTracePath[] {
    return this.outputTraces
  }

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }

    // Visualize input problem
    const inputVis = visualizeInputProblem(this.input.inputProblem)
    graphics.lines!.push(...(inputVis.lines as Line[]))
    graphics.points!.push(...(inputVis.points ?? []))
    graphics.rects!.push(...(inputVis.rects ?? []))

    // Visualize traces
    for (const trace of this.outputTraces) {
      const isActive = trace.mspPairId === this.activeTraceId
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        graphics.lines!.push({
          x1: trace.tracePath[i].x,
          y1: trace.tracePath[i].y,
          x2: trace.tracePath[i + 1].x,
          y2: trace.tracePath[i + 1].y,
          strokeColor: isActive ? "red" : "blue",
          label: `${trace.mspPairId}${isActive ? " (active)" : ""}`,
        })
      }
    }

    return graphics
  }
}