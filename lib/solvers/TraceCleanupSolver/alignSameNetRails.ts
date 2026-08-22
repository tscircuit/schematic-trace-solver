import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import { evaluateRailGroup } from "./sameNetRailAlignment/evaluateRailGroup"
import { getRailGroups } from "./sameNetRailAlignment/getRailGroups"
import type { AlignmentCandidate } from "./sameNetRailAlignment/types"

interface AlignSameNetRailsInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  eligibleTraceIds: ReadonlySet<string>
}

export const alignSameNetRails = ({
  inputProblem,
  traces,
  netLabelPlacements,
  eligibleTraceIds,
}: AlignSameNetRailsInput): {
  traces: SolvedTracePath[]
  alignedRailGroupCount: number
  alignedTraceCount: number
} => {
  let outputTraces = [...traces]
  const obstacles = getObstacleRects(inputProblem)
  const alignedTraceIds = new Set<string>()
  let alignedRailGroupCount = 0
  const maximumPasses = Math.max(
    1,
    traces.reduce((sum, trace) => sum + trace.tracePath.length, 0),
  )

  for (let pass = 0; pass < maximumPasses; pass++) {
    const groups = getRailGroups(
      outputTraces,
      eligibleTraceIds,
      inputProblem,
      obstacles,
    )
    let applied: AlignmentCandidate | null = null

    for (const group of groups) {
      applied = evaluateRailGroup({
        group,
        traces: outputTraces,
        netLabelPlacements,
        obstacles,
        eligibleTraceIds,
      })
      if (applied) break
    }
    if (!applied) break

    outputTraces = applied.traces
    alignedRailGroupCount++
    for (const traceId of applied.changedTraceIds) alignedTraceIds.add(traceId)
  }

  return {
    traces: outputTraces,
    alignedRailGroupCount,
    alignedTraceCount: alignedTraceIds.size,
  }
}
