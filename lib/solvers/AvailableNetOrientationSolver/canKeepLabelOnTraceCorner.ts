import { dir } from "lib/utils/dir"
import {
  getTraceCorners,
  getDistance,
} from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { EPS } from "./constants"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { SingleOverlapSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/SingleOverlapSolver/SingleOverlapSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { traceCrossesBoundsInterior } from "./geometry"

const LABEL_TRACE_CLEARANCE = 0.1

export const canKeepLabelOnTraceCorner = ({
  label,
  traces,
  inputProblem,
  netLabelPlacements,
}: {
  label: NetLabelPlacement
  traces: SolvedTracePath[]
  inputProblem: InputProblem
  netLabelPlacements: NetLabelPlacement[]
}) => {
  if (
    !traces.some(
      (trace) =>
        label.mspConnectionPairIds.includes(trace.mspPairId) &&
        getTraceCorners(trace.tracePath).some(
          (corner) => getDistance(corner, label.anchorPoint) <= EPS,
        ),
    )
  )
    return false
  const bounds = getRectBounds(label.center, label.width, label.height)
  for (const trace of traces) {
    if (!traceCrossesBoundsInterior(bounds, { [trace.mspPairId]: trace }))
      continue
    if (trace.globalConnNetId === label.globalConnNetId) return false
    // Validate with the same leaf solver used by the later collision stage.
    const solver = new SingleOverlapSolver({
      trace,
      label,
      problem: inputProblem,
      paddingBuffer: LABEL_TRACE_CLEARANCE,
      detourCount: 0,
      tracesToAvoidOverlapping: traces,
      netLabelPlacements,
    })
    solver.solve()
    if (
      !solver.solved ||
      !solver.solvedTracePath ||
      solver.solvedTracePath.length !== trace.tracePath.length
    )
      return false
    const direction = dir(label.orientation)
    // Preserve bends and only slide the obstructing wire away from the label.
    if (
      !solver.solvedTracePath.every((point, index) => {
        const original = trace.tracePath[index]!
        const dx = point.x - original.x
        const dy = point.y - original.y
        return (
          Math.abs(dx * direction.y - dy * direction.x) <= EPS &&
          dx * direction.x + dy * direction.y >= -EPS
        )
      })
    )
      return false
  }
  return true
}
