import {
  countPathIntersections,
  getPathLength,
} from "lib/solvers/Example28Solver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"
import type { CompletedTraceShift } from "lib/solvers/TraceOverlapShiftSolver/TraceOverlapShiftSolver"
import { getSameNetJunctions } from "lib/utils/getSameNetJunctions"
import { EPS, getDistance, tracePathContainsPoint } from "./geometry"
import type { TraceCornerCandidate } from "./types"

const pathsEqual = (
  first: SolvedTracePath["tracePath"],
  second: SolvedTracePath["tracePath"],
) =>
  first.length === second.length &&
  first.every((point, index) => getDistance(point, second[index]!) <= EPS)

/** Revalidate a recorded connector shift by projecting its label onto the pin's exit row. */
export const getStraightPortConnectorCandidate = ({
  label,
  traces,
  netLabelPlacements,
  netLabelConnectorTraceIds,
  completedTraceShifts,
  inputProblem,
}: {
  label: NetLabelPlacement
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  netLabelConnectorTraceIds: ReadonlySet<string>
  completedTraceShifts: CompletedTraceShift[]
  inputProblem: InputProblem
}): TraceCornerCandidate | undefined => {
  if (
    completedTraceShifts.length === 0 ||
    label.pinIds.length !== 1 ||
    (label.orientation !== "y+" && label.orientation !== "y-")
  )
    return

  const pins = inputProblem.chips.flatMap((chip) => chip.pins)
  const pin = pins.find((pin) => pin.pinId === label.pinIds[0])
  if (!pin) return

  for (const connector of traces) {
    if (
      !netLabelConnectorTraceIds.has(connector.mspPairId) ||
      connector.globalConnNetId !== label.globalConnNetId ||
      connector.pinIds.length !== 1 ||
      connector.pinIds[0] !== pin.pinId
    )
      continue

    const path = [...simplifyPath(connector.tracePath)]
    const shift = completedTraceShifts.find(
      (shift) => shift.initialTrace.mspPairId === connector.mspPairId,
    )
    if (!shift) continue
    const shiftedPath = simplifyPath(shift.shiftedTracePath)
    // Reconsider only actual overlap shifts that still match their recorded
    // result. A later reroute or an unchanged input is not ours to undo.
    if (
      !pathsEqual(path, shiftedPath) ||
      pathsEqual(simplifyPath(shift.initialTrace.tracePath), shiftedPath)
    )
      continue
    if (path.length < 2) continue
    if (getDistance(path.at(-1)!, pin) <= EPS) path.reverse()
    if (
      getDistance(path[0]!, pin) > EPS ||
      getDistance(path.at(-1)!, label.anchorPoint) > EPS ||
      Math.abs(path[1]!.y - pin.y) > EPS
    )
      continue

    const anchorPoint = { x: label.anchorPoint.x, y: pin.y }
    // Keep the label on the same side of the pin as its existing exit segment.
    if (
      Math.abs(anchorPoint.x - pin.x) <= EPS ||
      Math.sign(anchorPoint.x - pin.x) !== Math.sign(path[1]!.x - pin.x)
    )
      continue
    const reroutedTracePath = [path[0]!, anchorPoint]
    // Prefer fewer bends without increasing wire length, as in the existing
    // trace-reroute simplification passes.
    if (
      reroutedTracePath.length >= path.length ||
      getPathLength(reroutedTracePath) > getPathLength(path) + EPS
    )
      continue
    const protectedPoints = [
      ...getSameNetJunctions(connector, traces),
      ...pins,
      ...netLabelPlacements
        .filter((other) => other !== label)
        .map((other) => other.anchorPoint),
    ].filter((point) => tracePathContainsPoint(path, point))
    if (
      !protectedPoints.every((point) =>
        tracePathContainsPoint(reroutedTracePath, point),
      )
    )
      continue

    // An existing perpendicular crossing can move along the same wire, but
    // straightening must not introduce an additional crossing with any net.
    if (
      traces.some(
        (other) =>
          other.globalConnNetId !== connector.globalConnNetId &&
          countPathIntersections(reroutedTracePath, other.tracePath) >
            countPathIntersections(path, other.tracePath),
      )
    )
      continue

    return {
      anchorPoint,
      traceId: connector.mspPairId,
      distance: getDistance(anchorPoint, label.anchorPoint),
      pinAligned: true,
      reroutedTracePath,
    }
  }
}
