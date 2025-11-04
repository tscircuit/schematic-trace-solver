import type { GraphicsObject } from "graphics-debug"
import type { Point } from "@tscircuit/math-utils"

export const visualizeCandidates = (
  candidates: Point[][],
  color = "gray",
  intersectionPoints: Point[] = [],
): GraphicsObject => {
  const graphics: GraphicsObject = { lines: [], circles: [] }

  for (const candidate of candidates) {
    graphics.lines!.push({
      points: candidate,
      strokeColor: color,
    })
  }

  // Draw intersection points
  for (const point of intersectionPoints) {
    graphics.circles!.push({
      center: point,
      radius: 0.01, // Larger radius for intersection points
      fill: "green",
    })
  }

  return graphics
}
