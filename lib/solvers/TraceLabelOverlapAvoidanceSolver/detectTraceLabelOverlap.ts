import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { segmentIntersectsRect } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"

export interface TraceLabelOverlap {
  trace: SolvedTracePath
  label: NetLabelPlacement
}

/**
 * Detects overlaps between a set of traces and a set of net labels.
 * It identifies instances where a trace segment intersects with a label's bounding box.
 * Self-attachments (where a trace and label belong to the same net) are explicitly ignored
 * as they are not considered true overlaps for avoidance purposes.
 *
 * @param traces - An array of SolvedTracePath objects to check for overlaps.
 * @param netLabels - An array of NetLabelPlacement objects representing the labels.
 * @returns An array of TraceLabelOverlap objects, each indicating an overlap
 *          between a trace and a label.
 */
export const detectTraceLabelOverlap = ({
  traces,
  netLabels = [],
}: {
  traces: SolvedTracePath[]
  netLabels?: NetLabelPlacement[]
}): TraceLabelOverlap[] => {
  const overlaps: TraceLabelOverlap[] = []

  for (const trace of traces) {
    for (const label of netLabels) {
      const labelBounds = getRectBounds(label.center, label.width, label.height)

      for (let j = 0; j < trace.tracePath.length - 1; j++) {
        const p1 = trace.tracePath[j]
        const p2 = trace.tracePath[j + 1]

        if (segmentIntersectsRect(p1, p2, labelBounds)) {
          // If the trace and label belong to the same net, it's a legitimate connection, not an overlap to avoid.
          // This check is now redundant with the new logic in OverlapAvoidanceStepSolver,
          // but kept here for now as per instruction not to remove anything unnecessary.
          if (trace.globalConnNetId === label.globalConnNetId) {
            break // Break from the inner-most loop (segment loop)
          }
          overlaps.push({ trace, label })
          break // Break from the inner-most loop (segment loop)
        }
      }
    }
  }
  return overlaps
}
