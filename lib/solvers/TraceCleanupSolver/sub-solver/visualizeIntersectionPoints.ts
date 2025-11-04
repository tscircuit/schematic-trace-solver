import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"

/**
 * Visualizes a set of intersection points by drawing circles at their locations.
 * This function is used to highlight where different trace segments or obstacles intersect.
 */
export const visualizeIntersectionPoints = (
  points: Point[],
  color = "red",
): GraphicsObject => {
  const graphics: GraphicsObject = { circles: [] }

  for (const point of points) {
    graphics.circles!.push({
      center: {
        x: point.x,
        y: point.y,
      },
      radius: 0.01,
      fill: color,
    })
  }

  return graphics
}
