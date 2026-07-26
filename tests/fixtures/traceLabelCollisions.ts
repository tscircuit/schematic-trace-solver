import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export const getTraceLabelCollisions = (
  traces: SolvedTracePath[],
  labels: NetLabelPlacement[],
) => {
  const collisions: Array<{
    traceId: string
    traceNetId: string
    labelNetId: string
    segmentIndex: number
  }> = []

  for (const trace of traces) {
    for (const label of labels) {
      if (trace.globalConnNetId === label.globalConnNetId) continue

      const bounds = getRectBounds(label.center, label.width, label.height)
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        if (
          segmentIntersectsRect(
            trace.tracePath[i]!,
            trace.tracePath[i + 1]!,
            bounds,
          )
        ) {
          collisions.push({
            traceId: trace.mspPairId,
            traceNetId: trace.globalConnNetId,
            labelNetId: label.globalConnNetId,
            segmentIndex: i,
          })
        }
      }
    }
  }

  return collisions
}
