import type { GraphicsObject } from "graphics-debug"
import type { CollisionInfo } from "./isPathColliding"

/**
 * Visualizes a collision point if collision information is provided and a collision occurred.
 * It draws a red circle at the collision point to highlight the location of the collision.
 */
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
