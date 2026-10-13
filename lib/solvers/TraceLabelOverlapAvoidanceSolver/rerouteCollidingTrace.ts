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
  problem,
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

  // Right-facing pins on the same component can bypass an intervening label
  // with one shared outer rail. The local segment detour below can instead
  // wrap above and below the label, leaving an unnecessary loop.
  const [firstPin, secondPin] = trace.pins
  const sameSide =
    firstPin.chipId === secondPin.chipId &&
    firstPin._facingDirection === secondPin._facingDirection
  const facing = firstPin._facingDirection
  const pinA = initialTrace.tracePath[0]!
  const pinB = initialTrace.tracePath.at(-1)!
  const directOuterRailCandidates: Point[][] = []
  if (
    sameSide &&
    pinA.x === pinB.x &&
    Math.abs(pinA.y - pinB.y) <= 0.5 &&
    label.width <= Math.abs(pinA.y - pinB.y) + paddingBuffer + 1e-6 &&
    facing === "x+" &&
    label.orientation === "x+" &&
    problem.netConnections.some(
      (connection) =>
        connection.netId === label.netId && connection.pinIds.length > 1,
    ) &&
    label.anchorPoint.x === pinA.x &&
    label.anchorPoint.y > Math.min(pinA.y, pinB.y) &&
    label.anchorPoint.y < Math.max(pinA.y, pinB.y)
  ) {
    const railX = Math.max(pinA.x + 0.2, labelBounds.maxX + paddingBuffer)
    directOuterRailCandidates.push([
      pinA,
      { x: railX, y: pinA.y },
      { x: railX, y: pinB.y },
      pinB,
    ])
  }

  const fourPointCandidates = generateFourPointDetourCandidates({
    initialTrace,
    label,
    labelBounds,
    paddingBuffer,
    detourCount,
  })

  const effectivePadding = paddingBuffer + detourCount * paddingBuffer
  const paddedLabelBounds = {
    minX: labelBounds.minX - effectivePadding,
    maxX: labelBounds.maxX + effectivePadding,
    minY: labelBounds.minY - effectivePadding,
    maxY: labelBounds.maxY + effectivePadding,
  }

  const { firstInsideIndex, lastInsideIndex } = findTraceViolationZone({
    path: initialTrace.tracePath,
    labelBounds,
    paddedBounds: paddedLabelBounds,
  })

  const snipReconnectCandidates = generateSnipAndReconnectCandidates({
    initialTrace,
    firstInsideIndex,
    lastInsideIndex,
    labelBounds,
    paddingBuffer,
    detourCount,
  })

  return [
    ...directOuterRailCandidates,
    ...fourPointCandidates,
    ...snipReconnectCandidates,
  ]
}
