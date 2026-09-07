import type { InlineNetLabelOutput } from "./InlineNetLabelSolver"
import { getAnchoredNetLabelRenderedBounds } from "./getAnchoredNetLabelRenderedBounds"
import { boundsOverlap } from "lib/utils/textBoxBounds"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

/** Identify final geometry conflicts, including generated terminal wires. */
export const getOutputLabelCollisionKeys = (
  output: Omit<InlineNetLabelOutput, "inputProblem">,
) => {
  const labels = [
    ...output.netLabelPlacements,
    ...output.inlineNetLabelPlacements,
  ].map((label) => ({
    label,
    key: `${label.globalConnNetId}:${[...label.pinIds].sort().join(",")}`,
    bounds:
      "axis" in label
        ? {
            minX:
              label.center.x -
              (label.axis === "x" ? label.width : label.height) / 2,
            maxX:
              label.center.x +
              (label.axis === "x" ? label.width : label.height) / 2,
            minY:
              label.center.y -
              (label.axis === "x" ? label.height : label.width) / 2,
            maxY:
              label.center.y +
              (label.axis === "x" ? label.height : label.width) / 2,
          }
        : getAnchoredNetLabelRenderedBounds(label),
  }))
  const keys = new Set<string>()
  for (let i = 0; i < labels.length; i++)
    for (const other of labels.slice(i + 1)) {
      if (boundsOverlap(labels[i]!.bounds, other.bounds))
        keys.add(`labels:${[labels[i]!.key, other.key].sort().join("/")}`)
    }
  const traces = [
    ...output.traces,
    ...output.inlineNetLabelPlacements.flatMap((label) =>
      label.stubTracePath
        ? [
            {
              mspPairId: `inline:${label.globalConnNetId}:${[...label.pinIds].sort().join(",")}`,
              globalConnNetId: label.globalConnNetId,
              tracePath: label.stubTracePath,
            },
          ]
        : [],
    ),
  ]
  for (const trace of traces)
    for (const { label, key, bounds } of labels) {
      if (
        ("axis" in label || label.globalConnNetId !== trace.globalConnNetId) &&
        trace.tracePath
          .slice(1)
          .some((end, index) =>
            segmentIntersectsRect(trace.tracePath[index]!, end, bounds),
          )
      )
        keys.add(`trace:${trace.mspPairId}/${key}`)
    }
  return keys
}
