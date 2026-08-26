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
  return output
}
