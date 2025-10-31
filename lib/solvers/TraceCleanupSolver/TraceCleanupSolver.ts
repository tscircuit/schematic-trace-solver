import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import { minimizeTurnsWithFilteredLabels } from "./minimizeTurnsWithFilteredLabels"
import { balanceZShapes } from "./balanceZShapes"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"

interface TraceCleanupSolverInput {
  inputProblem: InputProblem
  allTraces: SolvedTracePath[]
  targetTraceIds: Set<string>
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
}

type PipelineStep = "minimizing_turns" | "balancing_l_shapes"

/**
 * Cleans up traces by minimizing turns and balancing L-shapes to improve
 * the overall aesthetics and readability of the schematic.
 */
export class TraceCleanupSolver extends BaseSolver {
  private input: TraceCleanupSolverInput
  private outputTraces: SolvedTracePath[]
  private traceIdQueue: string[]
  private tracesMap: Map<string, SolvedTracePath>
  private pipelineStep: PipelineStep = "minimizing_turns"
  private activeTraceId: string | null = null // New property

  constructor(solverInput: TraceCleanupSolverInput) {
    super()
    this.input = solverInput
    this.outputTraces = [...solverInput.allTraces]
    this.tracesMap = new Map(this.outputTraces.map((t) => [t.mspPairId, t]))
    this.traceIdQueue = Array.from(solverInput.targetTraceIds)
  }

  override _step() {
    if (
      this.pipelineStep === "minimizing_turns" &&
      this.traceIdQueue.length === 0
    ) {
      this.pipelineStep = "balancing_l_shapes"
      this.traceIdQueue = Array.from(this.input.targetTraceIds)
    }

    if (
      this.pipelineStep === "balancing_l_shapes" &&
      this.traceIdQueue.length === 0
    ) {
      this.solved = true
      return
    }

    const targetMspConnectionPairId = this.traceIdQueue.shift()!
    this.activeTraceId = targetMspConnectionPairId // Set active trace ID
    const originalTrace = this.tracesMap.get(targetMspConnectionPairId)!

    const { tracePath } = originalTrace

    // Skip if the trace is a perfect rectangle
    const is4PointRectangle = (path: typeof tracePath): boolean => {
      if (path.length !== 4) return false
      const [p0, p1, p2, p3] = path
      // H-V-H "C" shape
      const isHVHC =
        p0.y === p1.y && p1.x === p2.x && p2.y === p3.y && p0.x === p3.x
      // V-H-V "C" shape
      const isVHVC =
        p0.x === p1.x && p1.y === p2.y && p2.x === p3.x && p0.y === p3.y
      return isHVHC || isVHVC
    }

    if (is4PointRectangle(tracePath)) {
      return
    }

    const allTraces = Array.from(this.tracesMap.values())

    let updatedTrace: SolvedTracePath

    if (this.pipelineStep === "minimizing_turns") {
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

    // Update the state in the central map
    this.tracesMap.set(targetMspConnectionPairId, updatedTrace)

    // Update the output for visualization
    this.outputTraces = Array.from(this.tracesMap.values())
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
        strokeColor: trace.mspPairId === this.activeTraceId ? "red" : "blue", // Highlight active trace
      }
      graphics.lines!.push(line)
    }
    return graphics
  }
}
