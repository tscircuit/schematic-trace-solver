import type { GraphicsObject } from "graphics-debug"
import type { Rectangle } from "./sub-solver/generateRectangleCandidates"

/**
 * Visualizes a given rectangle by drawing it as a green-stroked rectangle.
 * This function is useful for highlighting specific rectangular areas in a graphical representation.
 */
export const visualizeTightRectangle = (
  rectangle: Rectangle,
): GraphicsObject => {
  const graphics: GraphicsObject = { rects: [] }

  graphics.rects!.push({
    center: {
      x: rectangle.x + rectangle.width / 2,
      y: rectangle.y + rectangle.height / 2,
    },
    width: rectangle.width,
    height: rectangle.height,
    stroke: "green",
  })

  return graphics
}
