import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { evaluateRailGroup } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/evaluateRailGroup"
import type { InputProblem } from "lib/types/InputProblem"
import { getSharedEndpointRailGroups } from "./getSharedEndpointRailGroups"

interface SharedEndpointJunctionSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  eligibleTraceIds: ReadonlySet<string>
}

export class SharedEndpointJunctionSolver extends BaseSolver {
  private readonly input: SharedEndpointJunctionSolverInput
  private outputTraces: SolvedTracePath[]

  constructor(input: SharedEndpointJunctionSolverInput) {
    super()
    this.input = input
    this.outputTraces = input.traces
    this.MAX_ITERATIONS = Math.max(
      1,
      input.traces.reduce(
        (pointCount, trace) => pointCount + trace.tracePath.length,
        0,
      ),
    )
  }

  override _step() {
    const obstacles = getObstacleRects(this.input.inputProblem)
    const groups = getSharedEndpointRailGroups(
      this.outputTraces,
      this.input.eligibleTraceIds,
      this.input.inputProblem,
    )

    for (const group of groups) {
      const candidate = evaluateRailGroup({
        group,
        traces: this.outputTraces,
        netLabelPlacements: this.input.netLabelPlacements,
        obstacles,
        eligibleTraceIds: this.input.eligibleTraceIds,
      })
      if (!candidate) continue

      this.outputTraces = candidate.traces
      this.stats.junctionCount = (this.stats.junctionCount ?? 0) + 1
      return
    }

    this.solved = true
  }

  getOutput() {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.input.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })
    graphics.lines = [
      ...(graphics.lines ?? []),
      ...this.outputTraces.map(
        (trace): Line => ({
          points: trace.tracePath,
          strokeColor: "blue",
        }),
      ),
    ]
    return graphics
  }
}
