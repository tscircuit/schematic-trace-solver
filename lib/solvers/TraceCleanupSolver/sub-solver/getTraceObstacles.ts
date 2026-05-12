import type { SolvedTracePath } from "../../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export interface TraceObstacle {
  points: Array<{ x: number; y: number }>
}

/**
 * Extracts obstacles from a list of solved trace paths, excluding a specific trace.
 * This function is used to treat other traces as obstacles when rerouting or cleaning up a particular trace.
 * It returns an array of TraceObstacle objects, where each obstacle is represented by the points of a trace path.
 */
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
