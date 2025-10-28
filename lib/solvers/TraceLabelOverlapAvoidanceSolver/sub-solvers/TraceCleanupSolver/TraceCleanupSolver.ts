import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import type { NetLabelPlacement } from "../../../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { minimizeTurnsWithFilteredLabels } from "./minimizeTurnsWithFilteredLabels"
import { balanceLShapes } from "./balanceLShapes"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"

interface TraceCleanupSolverInput {
  inputProblem: InputProblem
  allTraces: SolvedTracePath[]
  targetTraceIds: Set<string>
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
}

/**
 * Cleans up traces by minimizing turns and balancing L-shapes to improve
 * the overall aesthetics and readability of the schematic.
 */
export class TraceCleanupSolver extends BaseSolver {
  private input: TraceCleanupSolverInput
  private outputTraces: SolvedTracePath[]
  private pipelineStepIndex = 0
  private tracesToProcess: SolvedTracePath[]
  private minimizedTraces: SolvedTracePath[] | null = null
  private balancedTraces: SolvedTracePath[] | null = null

  constructor(solverInput: TraceCleanupSolverInput) {
    super()
    this.input = solverInput
    this.outputTraces = [...solverInput.allTraces]
    this.tracesToProcess = this.outputTraces.filter((t) =>
      this.input.targetTraceIds.has(t.mspPairId),
    )
  }

  override _step() {
    const {
      targetTraceIds,
      inputProblem,
      allLabelPlacements,
      mergedLabelNetIdMap,
      paddingBuffer,
    } = this.input

    if (targetTraceIds.size === 0) {
      this.solved = true
      return
    }

    switch (this.pipelineStepIndex) {
      case 0: {
        // Step 0: Minimize turns
        const minimizedTracesResult = minimizeTurnsWithFilteredLabels({
          traces: this.tracesToProcess,
          inputProblem,
          allLabelPlacements,
          mergedLabelNetIdMap,
          paddingBuffer,
        })

        this.minimizedTraces = minimizedTracesResult ?? this.tracesToProcess

        const tracesMap = new Map(
          this.input.allTraces.map((t) => [t.mspPairId, t]),
        )
        for (const trace of this.minimizedTraces) {
          tracesMap.set(trace.mspPairId, trace)
        }
        this.outputTraces = Array.from(tracesMap.values())
        this.pipelineStepIndex++
        break
      }
      case 1: {
        // Step 1: Balance L-shapes
        const balancedTracesResult = balanceLShapes({
          traces: this.minimizedTraces!,
          inputProblem,
          allLabelPlacements,
        })

        this.balancedTraces = balancedTracesResult ?? this.minimizedTraces

        const tracesMap = new Map(
          this.input.allTraces.map((t) => [t.mspPairId, t]),
        )
        for (const trace of this.balancedTraces!) {
          tracesMap.set(trace.mspPairId, trace)
        }
        this.outputTraces = Array.from(tracesMap.values())
        this.pipelineStepIndex++
        break
      }
      case 2: {
        // Step 2: Done
        this.solved = true
        break
      }
    }
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
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
        strokeColor: "blue",
      }
      graphics.lines!.push(line)
    }
    return graphics
  }
}
