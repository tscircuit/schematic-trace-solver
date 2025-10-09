import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { segmentIntersectsRect } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"

export interface TraceLabelOverlap {
  trace: SolvedTracePath
  label: NetLabelPlacement
}

export const detectTraceLabelOverlap = (
  traces: SolvedTracePath[],
  netLabels: NetLabelPlacement[],
): TraceLabelOverlap[] => {
  const overlaps: TraceLabelOverlap[] = []

  for (const trace of traces) {
    for (const label of netLabels) {
      const labelBounds = getRectBounds(label.center, label.width, label.height)

      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        const p1 = trace.tracePath[i]
        const p2 = trace.tracePath[i + 1]

        if (segmentIntersectsRect(p1, p2, labelBounds)) {
          // Check if the trace and label belong to the same net.
          // If so, it's a self-attachment, not a collision.
          if (trace.globalConnNetId === label.globalConnNetId) {
            break // Move to the next label
          }
          overlaps.push({ trace, label })
          break // Move to the next label
        }
      }
    }
  }
  return overlaps
}
