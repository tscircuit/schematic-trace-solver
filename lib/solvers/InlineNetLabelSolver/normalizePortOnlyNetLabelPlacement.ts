import { EPS } from "lib/solvers/AvailableNetOrientationSolver/constants"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getCenterFromAnchor } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const pointsEqual = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

const getOutputAnchorPoint = (
  placement: NetLabelPlacement,
  traces: SolvedTracePath[],
) => {
  const connector = traces.find(
    (trace) =>
      trace.outputLabelAnchorPoint !== undefined &&
      trace.globalConnNetId === placement.globalConnNetId &&
      trace.pinIds.length === 1 &&
      trace.pinIds[0] === placement.pinIds[0] &&
      trace.tracePath.at(-1) !== undefined &&
      pointsEqual(trace.tracePath.at(-1)!, placement.anchorPoint),
  )
  return connector?.outputLabelAnchorPoint ?? placement.anchorPoint
}

export function normalizePortOnlyNetLabelPlacement(
  placement: NetLabelPlacement,
  traces: SolvedTracePath[],
): NetLabelPlacement {
  if (placement.pinIds.length !== 1) return placement
  if (placement.mspConnectionPairIds.length !== 0) return placement

  const anchorPoint = getOutputAnchorPoint(placement, traces)

  return {
    ...placement,
    anchorPoint,
    center: getCenterFromAnchor(
      anchorPoint,
      placement.orientation,
      placement.width,
      placement.height,
    ),
  }
}
