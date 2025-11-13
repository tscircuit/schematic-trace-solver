import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import { findTraceViolationZone } from "./violation"
import { generateSnipAndReconnectCandidates } from "./trySnipAndReconnect"
import { generateFourPointDetourCandidates } from "./tryFourPointDetour"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"

/**
 * Generates a list of candidate rerouted paths for a given trace that is
 * colliding with a net label.
 *
 * This function employs multiple strategies to propose alternative paths:
 * 1.  **Four-Point Detour:** Creates a rectangular detour around the label.
 * 2.  **Snip and Reconnect:** Attempts to remove the colliding segment and
 *     reconnect the trace around the obstacle.
 *
 * The candidates are generated with increasing padding based on `detourCount`
 * to explore progressively wider detours.
 */
export const generateRerouteCandidates = ({
  trace,
  label,
  paddingBuffer,
  detourCount,
}: {
  trace: SolvedTracePath
  label: NetLabelPlacement
  problem: InputProblem
  paddingBuffer: number
  detourCount: number
}): Point[][] => {
  const initialTrace = { ...trace, tracePath: simplifyPath(trace.tracePath) }

  if (trace.globalConnNetId === label.globalConnNetId) {
    return [initialTrace.tracePath]
  }

  const labelBoundsRaw = getRectBounds(label.center, label.width, label.height)
  const labelBounds = {
    minX: labelBoundsRaw.minX,
    minY: labelBoundsRaw.minY,
    maxX: labelBoundsRaw.maxX,
    maxY: labelBoundsRaw.maxY,
    chipId: `netlabel-${label.netId}`,
  }

  const fourPointCandidates = generateFourPointDetourCandidates({
    initialTrace,
    label,
    labelBounds,
    paddingBuffer,
    detourCount,
  })

  const { firstInsideIndex, lastInsideIndex } = findTraceViolationZone(
    initialTrace.tracePath,
    labelBounds,
  )

  const snipReconnectCandidates = generateSnipAndReconnectCandidates({
    initialTrace,
    firstInsideIndex,
    lastInsideIndex,
    labelBounds,
    paddingBuffer,
    detourCount,
  })

  return [...fourPointCandidates, ...snipReconnectCandidates]
}
