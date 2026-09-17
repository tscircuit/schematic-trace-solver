import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const EPS = 1e-9
const MAX_LOCAL_RAIL_SHIFT = 0.5
const MIN_ESCAPE_LENGTH = 1

const isHorizontal = (
  start: SolvedTracePath["tracePath"][number],
  end: SolvedTracePath["tracePath"][number],
) => Math.abs(start.y - end.y) <= EPS

const isVertical = (
  start: SolvedTracePath["tracePath"][number],
  end: SolvedTracePath["tracePath"][number],
) => Math.abs(start.x - end.x) <= EPS

const isBetween = (value: number, first: number, second: number) =>
  value >= Math.min(first, second) - EPS &&
  value <= Math.max(first, second) + EPS

/**
 * Shortens a same-side U-shaped connection when its vertical net label already
 * marks a safe rail column on one horizontal leg. Perpendicular trace crossings
 * remain crossings; the rail does not create junctions with those nets.
 */
export const shortenSameSideRailToLabelAnchor = ({
  traces,
  netLabelPlacements,
}: {
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}) => {
  const labelsByTraceId = new Map<string, NetLabelPlacement[]>()
  for (const label of netLabelPlacements) {
    if (label.orientation !== "y+" && label.orientation !== "y-") continue
    for (const traceId of label.mspConnectionPairIds) {
      const labels = labelsByTraceId.get(traceId) ?? []
      labels.push(label)
      labelsByTraceId.set(traceId, labels)
    }
  }

  return traces.map((trace) => {
    const path = trace.tracePath
    if (path.length !== 4) return trace
    const [firstPin, firstRail, secondRail, secondPin] = path
    if (
      !firstPin ||
      !firstRail ||
      !secondRail ||
      !secondPin ||
      !isHorizontal(firstPin, firstRail) ||
      !isVertical(firstRail, secondRail) ||
      !isHorizontal(secondRail, secondPin) ||
      Math.abs(firstPin.x - secondPin.x) > EPS
    ) {
      return trace
    }

    const label = (labelsByTraceId.get(trace.mspPairId) ?? []).find(
      ({ anchorPoint }) =>
        ((Math.abs(anchorPoint.y - firstPin.y) <= EPS &&
          isBetween(anchorPoint.x, firstPin.x, firstRail.x)) ||
          (Math.abs(anchorPoint.y - secondPin.y) <= EPS &&
            isBetween(anchorPoint.x, secondRail.x, secondPin.x))) &&
        Math.abs(anchorPoint.x - firstPin.x) <
          Math.abs(firstRail.x - firstPin.x) - EPS &&
        Math.abs(anchorPoint.x - firstRail.x) <= MAX_LOCAL_RAIL_SHIFT + EPS &&
        Math.abs(firstRail.x - firstPin.x) >= MIN_ESCAPE_LENGTH - EPS,
    )
    if (!label) return trace

    return {
      ...trace,
      tracePath: [
        firstPin,
        { x: label.anchorPoint.x, y: firstPin.y },
        { x: label.anchorPoint.x, y: secondPin.y },
        secondPin,
      ],
    }
  })
}
