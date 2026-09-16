import type { Bounds, Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "./NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getAnchoredNetLabelRenderedBounds } from "lib/solvers/InlineNetLabelSolver/getAnchoredNetLabelRenderedBounds"
import { segmentIntersectsRect } from "./SingleNetLabelPlacementSolver/collisions"

export const NET_LABEL_TRACE_CLEARANCE = 0.05
const EPS = 1e-6
const expand = (bounds: Bounds): Bounds => ({
  minX: bounds.minX - NET_LABEL_TRACE_CLEARANCE + EPS,
  maxX: bounds.maxX + NET_LABEL_TRACE_CLEARANCE - EPS,
  minY: bounds.minY - NET_LABEL_TRACE_CLEARANCE + EPS,
  maxY: bounds.maxY + NET_LABEL_TRACE_CLEARANCE - EPS,
})

/** Validate the rendered tag and its entire proposed connector as one placement.
 * Unlike strict crossing tests, padded bounds reject endpoint contacts, near
 * contacts and parallel overlaps with another net. Same-net attachments remain legal.
 */
export const isLabelAndConnectorClearOfTraces = ({
  label,
  connectorPath,
  traces,
}: {
  label: NetLabelPlacement
  connectorPath: Point[]
  traces: SolvedTracePath[]
}): boolean => {
  const bounds = [expand(getAnchoredNetLabelRenderedBounds(label))]
  for (let index = 0; index < connectorPath.length; index++) {
    const a = connectorPath[index]!
    const b = connectorPath[index + 1] ?? a
    if (Math.abs(a.x - b.x) > EPS && Math.abs(a.y - b.y) > EPS) return false
    bounds.push(
      expand({
        minX: Math.min(a.x, b.x),
        maxX: Math.max(a.x, b.x),
        minY: Math.min(a.y, b.y),
        maxY: Math.max(a.y, b.y),
      }),
    )
  }
  return !traces.some(
    (trace) =>
      trace.globalConnNetId !== label.globalConnNetId &&
      trace.tracePath.some((a, index) => {
        const b = trace.tracePath[index + 1] ?? a
        return bounds.some(
          (box) =>
            (a.x > box.minX &&
              a.x < box.maxX &&
              a.y > box.minY &&
              a.y < box.maxY) ||
            segmentIntersectsRect(a, b, box),
        )
      }),
  )
}
