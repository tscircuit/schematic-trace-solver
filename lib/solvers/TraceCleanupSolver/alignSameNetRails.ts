import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import { evaluateRailGroup } from "./sameNetRailAlignment/evaluateRailGroup"
import { getRailChainCoordinate } from "./sameNetRailAlignment/getRailChainCoordinate"
import { getRailGroups } from "./sameNetRailAlignment/getRailGroups"
import type { AlignmentCandidate } from "./sameNetRailAlignment/types"

interface AlignSameNetRailsInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  eligibleTraceIds: ReadonlySet<string>
}

const getTraceStateKey = (traces: SolvedTracePath[]) =>
  JSON.stringify(
    traces.map((trace) => ({
      mspPairId: trace.mspPairId,
      tracePath: trace.tracePath,
    })),
  )

export const alignSameNetRails = ({
  inputProblem,
  traces,
  netLabelPlacements,
  eligibleTraceIds,
}: AlignSameNetRailsInput): {
  traces: SolvedTracePath[]
  alignedRailGroupCount: number
  alignedTraceCount: number
  alignedRailTraceIds: ReadonlySet<string>
} => {
  let outputTraces = [...traces]
  const seenTraceStates = new Set([getTraceStateKey(outputTraces)])
  const obstacles = getObstacleRects(inputProblem)
  const alignedRailTraceIds = new Set<string>()
  const changedTraceIds = new Set<string>()
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
      netLabelPlacements,
    )
    let applied: AlignmentCandidate | null = null

    for (const group of groups) {
      const railChainCoordinate = getRailChainCoordinate(group, outputTraces)
      applied = evaluateRailGroup({
        group,
        traces: outputTraces,
        netLabelPlacements,
        obstacles,
        eligibleTraceIds,
      })
      if (applied && railChainCoordinate !== null) {
        for (const segment of group) {
          alignedRailTraceIds.add(segment.traceId)
        }
      }
      if (applied) break
    }
    if (!applied) break

    const candidateStateKey = getTraceStateKey(applied.traces)
    // A rail can be eligible from both endpoint components. When that creates
    // a cycle, restore the first-seen state instead of making the final layout
    // depend on the maximum-pass parity.
    const repeatsSeenState = seenTraceStates.has(candidateStateKey)
    if (!repeatsSeenState) seenTraceStates.add(candidateStateKey)
    outputTraces = applied.traces
    alignedRailGroupCount++
    for (const traceId of applied.changedTraceIds) {
      changedTraceIds.add(traceId)
    }
    if (repeatsSeenState) break
  }

  return {
    traces: outputTraces,
    alignedRailGroupCount,
    alignedTraceCount: changedTraceIds.size,
    alignedRailTraceIds,
  }
}
