import type { InlineNetLabelPlacement } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import { getAnchoredNetLabelRenderedBounds } from "lib/solvers/InlineNetLabelSolver/getAnchoredNetLabelRenderedBounds"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { boundsOverlap } from "lib/utils/textBoxBounds"

export const findLabelCollisions = (output: {
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  inlineNetLabelPlacements: InlineNetLabelPlacement[]
}) => {
  const labels = [
    ...output.netLabelPlacements,
    ...output.inlineNetLabelPlacements,
  ]
  const bounds = (label: (typeof labels)[number]) => {
    if (!("axis" in label)) return getAnchoredNetLabelRenderedBounds(label)
    const width = label.axis === "x" ? label.width : label.height
    const height = label.axis === "x" ? label.height : label.width
    return {
      minX: label.center.x - width / 2,
      maxX: label.center.x + width / 2,
      minY: label.center.y - height / 2,
      maxY: label.center.y + height / 2,
    }
  }
  const labelPairs = labels.flatMap((label, index) =>
    labels
      .slice(index + 1)
      .filter((other) => boundsOverlap(bounds(label), bounds(other)))
      .map((other) => [label, other]),
  )
  const traces = [
    ...output.traces,
    ...output.inlineNetLabelPlacements.flatMap((label) =>
      label.stubTracePath
        ? [
            {
              globalConnNetId: label.globalConnNetId,
              mspPairId: `inline-${label.pinIds.join("-")}`,
              tracePath: label.stubTracePath,
            },
          ]
        : [],
    ),
  ]
  const traceLabels = traces.flatMap((trace) =>
    labels
      .filter(
        (label) =>
          ("axis" in label ||
            label.globalConnNetId !== trace.globalConnNetId) &&
          trace.tracePath
            .slice(1)
            .some((end, index) =>
              segmentIntersectsRect(
                trace.tracePath[index]!,
                end,
                bounds(label),
              ),
            ),
      )
      .map((label) => ({ traceId: trace.mspPairId, label })),
  )
  return { labelPairs, traceLabels }
}
