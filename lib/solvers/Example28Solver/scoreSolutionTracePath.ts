import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { countCrossingsWithOtherTraces } from "./countCrossingsWithOtherTraces"
import { doesPathRunAlongChipBoundary } from "./doesPathRunAlongChipBoundary"
import type { ChipObstacle } from "./types"

export type TracePathScore = {
  chipEdgeRuns: number
  traceCrossings: number
}

export const scoreSolutionTracePath = (params: {
  traces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  chipObstacles: ChipObstacle[]
}): TracePathScore => {
  const { traces, outputTraces, chipObstacles } = params
  let chipEdgeRuns = 0
  let traceCrossings = 0
  for (const trace of traces) {
    if (doesPathRunAlongChipBoundary(trace.tracePath, chipObstacles)) {
      chipEdgeRuns += 1
    }
    traceCrossings += countCrossingsWithOtherTraces({ trace, outputTraces })
  }
  return { chipEdgeRuns, traceCrossings }
}
