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

/** Put a shared decoupling GND at the load end of its rail, away from the IC. */
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
  const groundNetId = netConnMap.getNetConnectedToId("GND")
  if (!groundNetId) return netLabelPlacements
  const chipMap = new Map(inputProblem.chips.map((chip) => [chip.chipId, chip]))
  const traceMap = Object.fromEntries(
    traces.map((trace) => [trace.mspPairId, trace]),
  )
  const obstacles = getObstacleRects(inputProblem)
  const output = [...netLabelPlacements]

  for (const rail of traces) {
    if (rail.globalConnNetId !== groundNetId) continue
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
      if (feed.globalConnNetId !== groundNetId) continue
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
          label.globalConnNetId !== groundNetId ||
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
    if (label.orientation !== "y-") continue
    // Use producer metadata so ground aliases do not require name matching.
    const connection = inputProblem.netConnections.find(
      (candidate) =>
        candidate.isGround &&
        candidate.netId === label.netId &&
        candidate.pinIds.length > 2,
    )
    if (!connection) continue

    // Follow only the continuous column attached to this label. Separate
    // ground branches may share an x coordinate without sharing a rail.
    const columnSegments = traces
      .filter((trace) => trace.globalConnNetId === label.globalConnNetId)
      .flatMap((trace) =>
        trace.tracePath.slice(1).flatMap((end, pointIndex) => {
          const start = trace.tracePath[pointIndex]!
          return nearlyEqual(start.x, label.anchorPoint.x) &&
            nearlyEqual(end.x, label.anchorPoint.x)
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
    if (nearlyEqual(lowestY, label.anchorPoint.y)) continue
    const anchorPoint = { x: label.anchorPoint.x, y: lowestY }

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

    output[index] = { ...label, anchorPoint, center }
  }
  return output
}
