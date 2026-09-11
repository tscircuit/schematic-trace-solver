import { getTracesShiftedClearOfLabel } from "./getTracesShiftedClearOfLabel"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  getCenterFromAnchor,
  getRectBounds,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  EPS,
  getDistance,
  getTraceCorners,
  isTraceLine,
  tracePathContainsPoint,
} from "./geometry"
import type { TraceCornerCandidate } from "./types"

export const getDetachedRailCornerCandidates = ({
  label,
  traces,
}: {
  label: NetLabelPlacement
  traces: SolvedTracePath[]
}): TraceCornerCandidate[] => {
  const hostTraces = traces.filter((trace) =>
    label.mspConnectionPairIds.includes(trace.mspPairId),
  )
  const hostCorners = hostTraces.flatMap((trace) =>
    getTraceCorners(trace.tracePath),
  )
  if (hostCorners.length === 0) return []

  const candidates: TraceCornerCandidate[] = []
  for (const trace of traces) {
    if (!isTraceLine(trace) || trace.globalConnNetId !== label.globalConnNetId)
      continue
    if (label.mspConnectionPairIds.includes(trace.mspPairId)) continue
    if (
      trace.pinIds.length !== label.pinIds.length ||
      !trace.pinIds.every((pinId) => label.pinIds.includes(pinId))
    )
      continue

    let path = trace.tracePath
    if (getDistance(path[0]!, label.anchorPoint) <= EPS)
      path = [...path].reverse()
    if (getDistance(path[path.length - 1]!, label.anchorPoint) > EPS) continue
    if (trace.pins.some((pin) => getDistance(pin, label.anchorPoint) <= EPS))
      continue
    if (
      !hostTraces.some((hostTrace) =>
        tracePathContainsPoint(hostTrace.tracePath, path[0]!),
      )
    )
      continue
    const anchorPoint = path[path.length - 2]
    if (!anchorPoint || Math.abs(anchorPoint.x - label.anchorPoint.x) > EPS)
      continue
    if (!getTraceCorners(path).includes(anchorPoint)) continue

    const center = getCenterFromAnchor(
      anchorPoint,
      label.orientation,
      label.width,
      label.height,
    )
    const bounds = getRectBounds(center, label.width, label.height)
    for (const hostTrace of hostTraces) {
      for (const hostCorner of getTraceCorners(hostTrace.tracePath)) {
        if (
          hostCorner.x < bounds.minX ||
          hostCorner.x > bounds.maxX ||
          hostCorner.y < bounds.minY ||
          hostCorner.y > bounds.maxY
        )
          continue
        const cornerIndex = hostTrace.tracePath.indexOf(hostCorner)
        const previousPoint = hostTrace.tracePath[cornerIndex - 1]!
        const nextPoint = hostTrace.tracePath[cornerIndex + 1]!
        if (
          Math.abs(previousPoint.y - hostCorner.y) > EPS ||
          Math.abs(nextPoint.x - hostCorner.x) > EPS
        )
          continue
        if (!tracePathContainsPoint([previousPoint, hostCorner], path[0]!))
          continue
        const sharedCorner = hostCorner
        const sharedBounds = getRectBounds(
          getCenterFromAnchor(
            sharedCorner,
            label.orientation,
            label.width,
            label.height,
          ),
          label.width,
          label.height,
        )
        const reroutedNeighborTraces = getTracesShiftedClearOfLabel({
          bounds: sharedBounds,
          traces: traces.filter(
            (otherTrace) => otherTrace !== trace && otherTrace !== hostTrace,
          ),
        })
        if (!reroutedNeighborTraces) continue
        const reroutedTracePath = hostTrace.tracePath
        const disconnectsBranch = traces.some(
          (otherTrace) =>
            otherTrace !== trace &&
            otherTrace !== hostTrace &&
            otherTrace.globalConnNetId === label.globalConnNetId &&
            otherTrace.tracePath.some(
              (point) =>
                tracePathContainsPoint(path, point) &&
                !tracePathContainsPoint(reroutedTracePath, point),
            ),
        )
        if (disconnectsBranch) continue
        candidates.push({
          anchorPoint: sharedCorner,
          traceId: hostTrace.mspPairId,
          distance: getDistance(sharedCorner, label.anchorPoint),
          pinAligned: true,
          reroutedTracePath,
          reroutedNeighborTraces,
          absorbedConnectorTraceId: trace.mspPairId,
        })
      }
    }
  }
  return candidates.sort((a, b) => a.distance - b.distance)
}
