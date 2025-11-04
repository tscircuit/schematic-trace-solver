import type { SolvedTracePath } from "../../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export interface TraceObstacle {
  points: Array<{ x: number; y: number }>
}

export const getTraceObstacles = (
  allTraces: SolvedTracePath[],
  excludeTraceId: string,
): TraceObstacle[] => {
  const obstacles: TraceObstacle[] = []

  for (const trace of allTraces) {
    if (trace.mspPairId !== excludeTraceId) {
      obstacles.push({ points: trace.tracePath })
    }
  }

  return obstacles
}
