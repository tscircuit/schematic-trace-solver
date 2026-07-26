import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { countPathIntersections } from "./geometry"

export const countCrossingsWithOtherTraces = (params: {
  trace: SolvedTracePath
  outputTraces: SolvedTracePath[]
}) => {
  const { trace, outputTraces } = params
  let crossingCount = 0
  for (const otherTrace of outputTraces) {
    if (otherTrace.mspPairId === trace.mspPairId) continue
    if (otherTrace.globalConnNetId === trace.globalConnNetId) continue
    crossingCount += countPathIntersections(
      trace.tracePath,
      otherTrace.tracePath,
    )
  }
  return crossingCount
}
