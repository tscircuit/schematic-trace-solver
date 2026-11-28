import type { Point } from "@tscircuit/math-utils"
import type { ObstacleRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { ChipId } from "lib/types/InputProblem"
import { dir, type FacingDirection } from "lib/utils/dir"

const COORDINATE_TOLERANCE = 1e-6

export const doesTerminalSegmentExitEnclosingChipObstacle = ({
  pin,
  neighbor,
  obstacle,
}: {
  pin: Point & { chipId: ChipId; _facingDirection?: FacingDirection }
  neighbor: Point
  obstacle: ObstacleRect
}): boolean => {
  if (
    !pin._facingDirection ||
    obstacle.kind !== "chip" ||
    obstacle.chipId === pin.chipId
  ) {
    return false
  }
  if (
    pin.x <= obstacle.minX + COORDINATE_TOLERANCE ||
    pin.x >= obstacle.maxX - COORDINATE_TOLERANCE ||
    pin.y <= obstacle.minY + COORDINATE_TOLERANCE ||
    pin.y >= obstacle.maxY - COORDINATE_TOLERANCE
  ) {
    return false
  }

  const outward = dir(pin._facingDirection)
  const centerX = (obstacle.minX + obstacle.maxX) / 2
  const centerY = (obstacle.minY + obstacle.maxY) / 2
  if (
    outward.x !== 0 &&
    (pin.x - centerX) * outward.x < -COORDINATE_TOLERANCE
  ) {
    return false
  }
  if (
    outward.y !== 0 &&
    (pin.y - centerY) * outward.y < -COORDINATE_TOLERANCE
  ) {
    return false
  }

  const stepAlongOutward =
    (neighbor.x - pin.x) * outward.x + (neighbor.y - pin.y) * outward.y
  const stepPerpendicular =
    Math.abs((neighbor.x - pin.x) * outward.y) +
    Math.abs((neighbor.y - pin.y) * outward.x)
  if (
    stepAlongOutward <= COORDINATE_TOLERANCE ||
    stepPerpendicular > COORDINATE_TOLERANCE
  ) {
    return false
  }

  return (
    neighbor.x <= obstacle.minX + COORDINATE_TOLERANCE ||
    neighbor.x >= obstacle.maxX - COORDINATE_TOLERANCE ||
    neighbor.y <= obstacle.minY + COORDINATE_TOLERANCE ||
    neighbor.y >= obstacle.maxY - COORDINATE_TOLERANCE
  )
}
