import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { detectTraceLabelOverlap } from "../../detectTraceLabelOverlap"

interface Props {
  trace: SolvedTracePath
  label: NetLabelPlacement
}

/**
 * Checks if the first or last segment of a given trace overlaps with a specified net label.
 * This is useful for determining if a trace begins or ends within an obstacle.
 */
export const doesTraceStartOrEndInLabel = ({ trace, label }: Props) => {
  if (trace.tracePath.length < 2) {
    return false // Not a valid trace with segments
  }

  // Create a mini-trace for the first segment
  const firstSegmentTrace: SolvedTracePath = {
    ...trace,
    tracePath: [trace.tracePath[0], trace.tracePath[1]],
  }

  // Check for overlap with the first segment
  const firstSegmentOverlap = detectTraceLabelOverlap({
    traces: [firstSegmentTrace],
    netLabels: [label],
  })

  if (firstSegmentOverlap.length > 0) {
    return true
  }

  // If the trace has more than one segment, check the last one
  if (trace.tracePath.length > 2) {
    const lastPoint = trace.tracePath[trace.tracePath.length - 1]
    const secondToLastPoint = trace.tracePath[trace.tracePath.length - 2]

    // Create a mini-trace for the last segment
    const lastSegmentTrace: SolvedTracePath = {
      ...trace,
      tracePath: [secondToLastPoint, lastPoint],
    }

    // Check for overlap with the last segment
    const lastSegmentOverlap = detectTraceLabelOverlap({
      traces: [lastSegmentTrace],
      netLabels: [label],
    })

    if (lastSegmentOverlap.length > 0) {
      return true
    }
  }

  return false
}
