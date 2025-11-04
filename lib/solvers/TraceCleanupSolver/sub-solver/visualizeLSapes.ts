import type { LShape } from "./findAllLShapedTurns"
import type { GraphicsObject } from "graphics-debug"

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
