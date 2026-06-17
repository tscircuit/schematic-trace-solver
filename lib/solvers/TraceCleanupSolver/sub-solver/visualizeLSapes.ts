import type { LShape } from "./findAllLShapedTurns"
import type { GraphicsObject } from "graphics-debug"

/**
 * Visualizes L-shaped turns by drawing a blue circle at the corner point (p2)
 * and light blue lines connecting p1, p2, and p3.
 * This function can visualize a single L-shape or an array of L-shapes.
 */
export const visualizeLSapes = (lShapes: LShape[] | LShape): GraphicsObject => {
  const graphics: GraphicsObject = { circles: [], lines: [] }

  const lShapesArray = Array.isArray(lShapes) ? lShapes : [lShapes]

  for (const lShape of lShapesArray) {
    // Draw the center point as a blue ball
    graphics.circles!.push({
      center: {
        x: lShape.p2.x,
        y: lShape.p2.y,
      },
      radius: 0.01,
      fill: "blue",
    })

    // Draw the two lines in a light blue color
    graphics.lines!.push({
      points: [lShape.p1, lShape.p2, lShape.p3],
      strokeColor: "lightblue",
    })
  }

  return graphics
}
