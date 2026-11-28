import type { Bounds, Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"
import { findTraceViolationZone } from "../../violation"

const EPS = 1e-6
const PARALLEL_LANE_STEPS = [1, 2, 3] as const

export const getFallbackSpanningCandidates = ({
  initialTrace,
  label,
  problem,
  paddingBuffer,
  detourCount,
}: {
  initialTrace: SolvedTracePath
  label: NetLabelPlacement
  problem: InputProblem
  paddingBuffer: number
  detourCount: number
}): Point[][] => {
  if (label.globalConnNetId.startsWith("merged-group-")) return []

  const isGroundTrace = problem.netConnections.some(
    (net) =>
      Boolean(net.isGround) &&
      (net.netId === initialTrace.userNetId ||
        net.pinIds.some((pinId) => initialTrace.pinIds.includes(pinId))),
  )
  if (!isGroundTrace) return []

  const simplifiedInitialPath = simplifyPath(initialTrace.tracePath)
  if (
    simplifiedInitialPath.length < 4 ||
    initialTrace.pins.length !== 2 ||
    initialTrace.pins[0]?.chipId !== initialTrace.pins[1]?.chipId
  ) {
    return []
  }

  const labelBounds: Bounds = getRectBounds(
    label.center,
    label.width,
    label.height,
  )
  const paddedBounds: Bounds = {
    minX: labelBounds.minX - paddingBuffer,
    maxX: labelBounds.maxX + paddingBuffer,
    minY: labelBounds.minY - paddingBuffer,
    maxY: labelBounds.maxY + paddingBuffer,
  }
  const { firstInsideIndex, lastInsideIndex } = findTraceViolationZone({
    path: simplifiedInitialPath,
    labelBounds,
    paddedBounds,
  })
  if (
    firstInsideIndex <= 0 ||
    lastInsideIndex >= simplifiedInitialPath.length - 1 ||
    firstInsideIndex !== lastInsideIndex + 1
  ) {
    return []
  }

  const entryPoint = simplifiedInitialPath[firstInsideIndex - 1]!
  const exitPoint = simplifiedInitialPath[lastInsideIndex + 1]!
  const pathToEntry = simplifiedInitialPath.slice(0, firstInsideIndex)
  const pathFromExit = simplifiedInitialPath.slice(lastInsideIndex + 1)

  const spansVertically =
    Math.abs(initialTrace.pins[0]!.x - initialTrace.pins[1]!.x) < EPS &&
    Math.abs(entryPoint.x - exitPoint.x) < EPS &&
    ((entryPoint.y <= labelBounds.minY && exitPoint.y >= labelBounds.maxY) ||
      (exitPoint.y <= labelBounds.minY && entryPoint.y >= labelBounds.maxY))

  const spansHorizontally =
    Math.abs(initialTrace.pins[0]!.y - initialTrace.pins[1]!.y) < EPS &&
    Math.abs(entryPoint.y - exitPoint.y) < EPS &&
    ((entryPoint.x <= labelBounds.minX && exitPoint.x >= labelBounds.maxX) ||
      (exitPoint.x <= labelBounds.minX && entryPoint.x >= labelBounds.maxX))

  const detours: Point[][] = []
  for (const laneStep of PARALLEL_LANE_STEPS) {
    const buffer = (laneStep + detourCount) * paddingBuffer
    if (spansVertically) {
      const leftX = labelBounds.minX - buffer
      const rightX = labelBounds.maxX + buffer
      detours.push(
        [
          { x: leftX, y: entryPoint.y },
          { x: leftX, y: exitPoint.y },
        ],
        [
          { x: rightX, y: entryPoint.y },
          { x: rightX, y: exitPoint.y },
        ],
      )
    }
    if (spansHorizontally) {
      const topY = labelBounds.maxY + buffer
      const bottomY = labelBounds.minY - buffer
      detours.push(
        [
          { x: entryPoint.x, y: topY },
          { x: exitPoint.x, y: topY },
        ],
        [
          { x: entryPoint.x, y: bottomY },
          { x: exitPoint.x, y: bottomY },
        ],
      )
    }
  }

  return detours.map((detour) =>
    simplifyPath([...pathToEntry, ...detour, ...pathFromExit]),
  )
}
