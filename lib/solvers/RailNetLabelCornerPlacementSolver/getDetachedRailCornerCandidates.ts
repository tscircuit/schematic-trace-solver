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
    // Only close the offset beside an existing host bend; remote label branches
    // keep the clearance selected by the orientation solver.
    if (
      !hostCorners.some(
        (corner) =>
          corner.x >= bounds.minX &&
          corner.x <= bounds.maxX &&
          corner.y >= bounds.minY &&
          corner.y <= bounds.maxY,
      )
    )
      continue

    candidates.push({
      anchorPoint,
      traceId: trace.mspPairId,
      distance: getDistance(anchorPoint, label.anchorPoint),
      pinAligned: true,
      reroutedTracePath: path.slice(0, -1),
    })
  }
  return candidates.sort((a, b) => a.distance - b.distance)
}
