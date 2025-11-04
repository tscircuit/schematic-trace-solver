import type { GraphicsObject } from "graphics-debug"
import type { CollisionInfo } from "./isPathColliding"

export const visualizeCollision = (
  collisionInfo: CollisionInfo | null,
): GraphicsObject => {
  const collisionGraphics: GraphicsObject = { circles: [] }
  if (collisionInfo?.isColliding && collisionInfo.collisionPoint) {
    collisionGraphics.circles!.push({
      center: collisionInfo.collisionPoint,
      radius: 0.01,
      fill: "red",
    })
  }
  return collisionGraphics
}
