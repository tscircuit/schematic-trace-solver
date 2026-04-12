import type { GraphicsObject } from "graphics-debug"
import type { Guideline } from "./GuidelinesSolver"
import { getBounds } from "graphics-debug"

export const visualizeGuidelines = ({
  guidelines,
  graphics,
}: {
  guidelines: Guideline[]
  graphics: GraphicsObject
}) => {
  const globalBounds = getBounds(graphics)
  const boundsWidth = globalBounds.maxX - globalBounds.minX
  const boundsHeight = globalBounds.maxY - globalBounds.minY
  globalBounds.minX -= boundsWidth * 0.3
  globalBounds.maxX += boundsWidth * 0.3
  globalBounds.minY -= boundsHeight * 0.3
  globalBounds.maxY += boundsHeight * 0.3

  for (const guideline of guidelines) {
    if (guideline.orientation === "horizontal") {
      graphics.lines!.push({
        points: [
          { x: globalBounds.minX, y: guideline.y },
          { x: globalBounds.maxX, y: guideline.y },
        ],
        strokeColor: "rgba(0, 0, 0, 0.5)",
        strokeDash: "2 2",
      })
    }

    if (guideline.orientation === "vertical") {
      graphics.lines!.push({
        points: [
          { x: guideline.x, y: globalBounds.minY },
          { x: guideline.x, y: globalBounds.maxY },
        ],
        strokeColor: "rgba(0, 0, 0, 0.5)",
        strokeDash: "2 2",
      })
    }
  }

  return graphics
}
