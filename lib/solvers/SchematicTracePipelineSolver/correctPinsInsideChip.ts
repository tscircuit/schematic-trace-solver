import type { InputProblem } from "lib/types/InputProblem"
import { getInputChipBounds } from "../GuidelinesSolver/getInputChipBounds"

export const correctPinsInsideChips = (problem: InputProblem) => {
  for (const chip of problem.chips) {
    const bounds = getInputChipBounds(chip)
    for (const pin of chip.pins) {
      const isInside =
        pin.x > bounds.minX &&
        pin.x < bounds.maxX &&
        pin.y > bounds.minY &&
        pin.y < bounds.maxY

      if (!isInside) continue

      // When the pin already knows which way it faces (e.g. the consumer set it
      // from the schematic symbol), snap it to the edge along that direction and
      // keep the facing. A pin can end up inside the box when the box was
      // expanded to include the component's reference-designator text; snapping
      // to the nearest edge would move it to the wrong side (e.g. a horizontal
      // resistor whose wide ref text makes the bottom edge the closest one).
      if (pin._facingDirection) {
        if (pin._facingDirection === "x-") {
          pin.x = bounds.minX
        } else if (pin._facingDirection === "x+") {
          pin.x = bounds.maxX
        } else if (pin._facingDirection === "y-") {
          pin.y = bounds.minY
        } else {
          pin.y = bounds.maxY
        }
        continue
      }

      const distLeft = pin.x - bounds.minX
      const distRight = bounds.maxX - pin.x
      const distBottom = pin.y - bounds.minY
      const distTop = bounds.maxY - pin.y

      const minDist = Math.min(distLeft, distRight, distBottom, distTop)

      if (minDist === distLeft) {
        pin.x = bounds.minX
      } else if (minDist === distRight) {
        pin.x = bounds.maxX
      } else if (minDist === distBottom) {
        pin.y = bounds.minY
      } else {
        pin.y = bounds.maxY
      }

      // Clear any cached facing direction since geometry changed.
      pin._facingDirection = undefined
    }
  }
}
