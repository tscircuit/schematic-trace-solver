import type { GraphicsObject } from "graphics-debug"
import type { Rectangle } from "./sub-solver/generateRectangleCandidates"

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
