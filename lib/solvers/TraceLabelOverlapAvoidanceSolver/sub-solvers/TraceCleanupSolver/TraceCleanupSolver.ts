import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "../../../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { minimizeTurnsWithFilteredLabels } from "./minimizeTurnsWithFilteredLabels"
import { balanceLShapes } from "./balanceLShapes"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

interface TraceCleanupSolverInput {
  problem: InputProblem
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

  constructor(solverInput: TraceCleanupSolverInput) {
    super()
    this.input = solverInput
    this.outputTraces = [...solverInput.allTraces]
  }

  override _step() {
    const {
      allTraces,
      targetTraceIds,
      problem,
      allLabelPlacements,
      mergedLabelNetIdMap,
      paddingBuffer,
    } = this.input

    if (targetTraceIds.size === 0) {
      this.solved = true
      return
    }

    const tracesToProcess = allTraces.filter((t) =>
      targetTraceIds.has(t.mspPairId),
    )

    let cleanedTraces: SolvedTracePath[] | null = tracesToProcess

    const minimizedTraces = minimizeTurnsWithFilteredLabels({
      traces: cleanedTraces,
      problem,
      allLabelPlacements,
      mergedLabelNetIdMap,
      paddingBuffer,
    })

    if (minimizedTraces) {
      cleanedTraces = minimizedTraces
    }

    const balancedTraces = balanceLShapes({
      traces: cleanedTraces,
      problem,
      allLabelPlacements,
    })

    if (balancedTraces) {
      cleanedTraces = balancedTraces
    }

    // Merge the cleaned traces back into the main list
    const tracesMap = new Map(allTraces.map((t) => [t.mspPairId, t]))
    for (const cleanedTrace of cleanedTraces) {
      tracesMap.set(cleanedTrace.mspPairId, cleanedTrace)
    }

    this.outputTraces = Array.from(tracesMap.values())
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }
}
