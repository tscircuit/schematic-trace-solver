import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import { evaluateRailGroup } from "./sameNetRailAlignment/evaluateRailGroup"
import { getRailGroups } from "./sameNetRailAlignment/getRailGroups"
import type { AlignmentCandidate } from "./sameNetRailAlignment/types"
import { simplifyTraces } from "./sameNetRailAlignment/simplifyTracePath"

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

  const initialGroups = getRailGroups(
    outputTraces,
    eligibleTraceIds,
    inputProblem,
    obstacles,
  )

  const maximumPasses = Math.min(
    20,
    Math.max(Math.ceil(initialGroups.length / 2), 1),
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

  // Post-process: simplify trace paths by removing redundant collinear vertices.
  // This is conservative and safe — it does not change endpoints or connectivity,
  // only removes unnecessary intermediate points that are collinear.
  outputTraces = simplifyTraces(outputTraces)

  return {
    traces: outputTraces,
    alignedRailGroupCount,
    alignedTraceCount: alignedTraceIds.size,
  }
}
