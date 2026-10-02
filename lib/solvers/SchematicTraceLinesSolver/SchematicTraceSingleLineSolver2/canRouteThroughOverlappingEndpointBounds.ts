import type { Point } from "@tscircuit/math-utils"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { findFirstCollision } from "./collisions"
import type { ObstacleRect } from "./rect"

export const canRouteThroughOverlappingEndpointBounds = ({
  pins,
  path,
  obstacles,
}: {
  pins: MspConnectionPair["pins"]
  path: Point[]
  obstacles: ObstacleRect[]
}): boolean => {
  if (pins[0].chipId === pins[1].chipId) return false

  const endpointObstacles = pins.map((pin) =>
    obstacles.find(
      (obstacle) => obstacle.kind === "chip" && obstacle.chipId === pin.chipId,
    ),
  )
  const epsilon = 1e-9
  const mutuallyEnclosed = pins.every((pin, index) => {
    const opposite = endpointObstacles[1 - index]
    return (
      opposite !== undefined &&
      pin.x > opposite.minX + epsilon &&
      pin.x < opposite.maxX - epsilon &&
      pin.y > opposite.minY + epsilon &&
      pin.y < opposite.maxY - epsilon
    )
  })
  if (!mutuallyEnclosed) return false

  return (
    findFirstCollision(
      path,
      obstacles.filter((obstacle) => !endpointObstacles.includes(obstacle)),
    ) === null
  )
}
