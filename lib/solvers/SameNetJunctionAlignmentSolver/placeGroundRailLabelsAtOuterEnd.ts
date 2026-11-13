import { traceCrossesBoundsInterior } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  getCenterFromAnchor,
  getRectBounds,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import {
  rectsOverlap,
  tracePathContainsPoint,
} from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import {
  isHorizontal,
  isVertical,
  nearlyEqual,
  RAIL_ALIGNMENT_EPSILON,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"
import { getGroundNetIds } from "lib/utils/getGroundNetIds"

/** Place shared ground labels at a clear end of their connected rail. */
export const placeGroundRailLabelsAtOuterEnd = ({
  inputProblem,
  traces,
  netLabelPlacements,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}): NetLabelPlacement[] => {
  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
  const groundNetIds = getGroundNetIds(inputProblem, netConnMap)
  if (groundNetIds.size === 0) return netLabelPlacements
  const chipMap = new Map(inputProblem.chips.map((chip) => [chip.chipId, chip]))
  const traceMap = Object.fromEntries(
    traces.map((trace) => [trace.mspPairId, trace]),
  )
  const obstacles = getObstacleRects(inputProblem)
  const output = [...netLabelPlacements]

  for (const rail of traces) {
    if (!groundNetIds.has(rail.globalConnNetId)) continue
    const [a, b] = rail.pins
    if (
      a.chipId === b.chipId ||
      !nearlyEqual(a.y, b.y) ||
      ![a, b].every(
        (pin) =>
          pin._facingDirection === "y-" &&
          chipMap.get(pin.chipId)?.pins.length === 2,
      )
    )
      continue
    const path = simplifyPath(rail.tracePath)
    if (
      path.length !== 4 ||
      !isVertical(path[0]!, path[1]!) ||
      !isHorizontal(path[1]!, path[2]!) ||
      !isVertical(path[2]!, path[3]!) ||
      path[1]!.y >= a.y
    )
      continue

    for (const feed of traces) {
      if (feed.globalConnNetId !== rail.globalConnNetId) continue
      const shared = feed.pins.find((pin) => rail.pinIds.includes(pin.pinId))
      const icPin = feed.pins.find(
        (pin) =>
          !rail.pinIds.includes(pin.pinId) &&
          (chipMap.get(pin.chipId)?.pins.length ?? 0) > 2,
      )
      if (!shared || !icPin || !nearlyEqual(icPin.y, path[1]!.y)) continue
      const outer = shared.pinId === a.pinId ? b : a
      if (Math.abs(outer.x - icPin.x) <= Math.abs(shared.x - icPin.x)) continue
      const anchorPoint = { x: outer.x, y: path[1]!.y }
      if (!tracePathContainsPoint(rail.tracePath, anchorPoint)) continue

      for (let index = 0; index < output.length; index++) {
        const label = output[index]!
        if (
          label.globalConnNetId !== rail.globalConnNetId ||
          label.orientation !== "y-" ||
          !label.mspConnectionPairIds.some(
            (id) => id === feed.mspPairId || id === rail.mspPairId,
          ) ||
          (!tracePathContainsPoint(feed.tracePath, label.anchorPoint) &&
            !tracePathContainsPoint(rail.tracePath, label.anchorPoint))
        )
          continue
        const center = getCenterFromAnchor(
          anchorPoint,
          label.orientation,
          label.width,
          label.height,
        )
        const bounds = getRectBounds(center, label.width, label.height)
        if (
          obstacles.some((obstacle) => rectsOverlap(bounds, obstacle)) ||
          traceCrossesBoundsInterior(bounds, traceMap) ||
          output.some(
            (other, otherIndex) =>
              otherIndex !== index &&
              rectsOverlap(
                bounds,
                getRectBounds(other.center, other.width, other.height),
              ),
          )
        )
          continue
        output[index] = {
          ...label,
          anchorPoint,
          center,
          mspConnectionPairIds: [rail.mspPairId],
          pinIds: [...rail.pinIds],
        }
      }
    }
  }

  for (let index = 0; index < output.length; index++) {
    const label = output[index]!
    if (label.orientation !== "y-" || !groundNetIds.has(label.globalConnNetId))
      continue
    const hasSharedRail = inputProblem.netConnections.some(
      (candidate) =>
        candidate.pinIds.length > 2 &&
        netConnMap.getNetConnectedToId(candidate.netId) ===
          label.globalConnNetId,
    )
    if (!hasSharedRail) continue

    // Follow only the continuous column attached to this label. Separate
    // ground branches may share an x coordinate without sharing a rail.
    let columnX = label.anchorPoint.x
    const netTraces = traces.filter(
      (trace) => trace.globalConnNetId === label.globalConnNetId,
    )
    const hasVerticalAtAnchorX = netTraces.some((trace) =>
      trace.tracePath.slice(1).some((end, pointIndex) => {
        const start = trace.tracePath[pointIndex]!
        return (
          nearlyEqual(start.x, columnX) &&
          nearlyEqual(end.x, columnX) &&
          !nearlyEqual(start.y, end.y)
        )
      }),
    )
    const currentBounds = getRectBounds(label.center, label.width, label.height)
    const overlapsNeighborLabel = output.some(
      (other, otherIndex) =>
        otherIndex !== index &&
        rectsOverlap(
          currentBounds,
          getRectBounds(other.center, other.width, other.height),
        ),
    )
    if (!hasVerticalAtAnchorX && overlapsNeighborLabel) {
      for (const pairId of label.mspConnectionPairIds) {
        const hostTrace = traceMap[pairId]
        if (!hostTrace) continue
        const path = simplifyPath(hostTrace.tracePath)
        for (let i = 0; i < path.length - 1; i++) {
          const p0 = path[i]!
          const p1 = path[i + 1]!
          if (
            !isHorizontal(p0, p1) ||
            !nearlyEqual(p0.y, label.anchorPoint.y) ||
            label.anchorPoint.x <
              Math.min(p0.x, p1.x) - RAIL_ALIGNMENT_EPSILON ||
            label.anchorPoint.x > Math.max(p0.x, p1.x) + RAIL_ALIGNMENT_EPSILON
          )
            continue
          for (const endpoint of [p0, p1]) {
            const sharedColumn = netTraces.some(
              (otherTrace) =>
                otherTrace.mspPairId !== hostTrace.mspPairId &&
                otherTrace.tracePath.slice(1).some((end, pointIndex) => {
                  const start = otherTrace.tracePath[pointIndex]!
                  return (
                    nearlyEqual(start.x, endpoint.x) &&
                    nearlyEqual(end.x, endpoint.x) &&
                    !nearlyEqual(start.y, end.y)
                  )
                }),
            )
            if (sharedColumn) {
              columnX = endpoint.x
              break
            }
          }
        }
      }
    }

    const columnSegments = netTraces
      .flatMap((trace) =>
        trace.tracePath.slice(1).flatMap((end, pointIndex) => {
          const start = trace.tracePath[pointIndex]!
          return nearlyEqual(start.x, columnX) && nearlyEqual(end.x, columnX)
            ? [
                {
                  minY: Math.min(start.y, end.y),
                  maxY: Math.max(start.y, end.y),
                },
              ]
            : []
        }),
      )
      .sort((a, b) => b.maxY - a.maxY)
    let lowestY = label.anchorPoint.y
    for (const segment of columnSegments) {
      if (
        segment.maxY + RAIL_ALIGNMENT_EPSILON >= lowestY &&
        segment.minY < lowestY
      ) {
        lowestY = segment.minY
      }
    }
    if (
      nearlyEqual(columnX, label.anchorPoint.x) &&
      nearlyEqual(lowestY, label.anchorPoint.y)
    )
      continue
    const anchorPoint = { x: columnX, y: lowestY }

    const center = getCenterFromAnchor(
      anchorPoint,
      label.orientation,
      label.width,
      label.height,
    )
    const bounds = getRectBounds(center, label.width, label.height)
    // Keep the original anchor when the ground symbol would collide.
    if (
      obstacles.some((obstacle) => rectsOverlap(bounds, obstacle)) ||
      traceCrossesBoundsInterior(bounds, traceMap) ||
      output.some((other, otherIndex) => {
        if (otherIndex === index) return false
        const otherBounds = getRectBounds(
          other.center,
          other.width,
          other.height,
        )
        if (!rectsOverlap(bounds, otherBounds)) return false
        if (!rectsOverlap(currentBounds, otherBounds)) return true
        const currentOverlapX =
          Math.min(currentBounds.maxX, otherBounds.maxX) -
          Math.max(currentBounds.minX, otherBounds.minX)
        const nextOverlapX =
          Math.min(bounds.maxX, otherBounds.maxX) -
          Math.max(bounds.minX, otherBounds.minX)
        return nextOverlapX >= currentOverlapX - RAIL_ALIGNMENT_EPSILON
      })
    )
      continue

    output[index] = { ...label, anchorPoint, center }
  }
  return output
}
