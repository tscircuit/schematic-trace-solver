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
  private outputTraces: SolvedTracePath[]

  constructor(private readonly input: SharedEndpointJunctionSolverInput) {
    super()
    this.outputTraces = input.traces
    this.MAX_ITERATIONS = Math.max(
      1,
      input.traces.reduce(
        (pointCount, trace) => pointCount + trace.tracePath.length,
        0,
      ),
    )
  }

  override getConstructorParams(): SharedEndpointJunctionSolverInput {
    return this.input
  }

  override _step() {
    const { inputProblem, eligibleTraceIds, netLabelPlacements } = this.input
    const obstacles = getObstacleRects(inputProblem)
    const groups = getSharedEndpointRailGroups({
      traces: this.outputTraces,
      eligibleTraceIds,
      inputProblem,
    })

    for (const group of groups) {
      const candidate = evaluateRailGroup({
        group,
        traces: this.outputTraces,
        netLabelPlacements,
        obstacles,
        eligibleTraceIds,
      })
      if (!candidate) continue

      // Apply one junction at a time, then rebuild candidates from its new geometry.
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
    const traceLines = this.outputTraces.map(
      (trace): Line => ({
        points: trace.tracePath,
        strokeColor: "blue",
      }),
    )
    graphics.lines = [...(graphics.lines ?? []), ...traceLines]
    return graphics
  }
}
