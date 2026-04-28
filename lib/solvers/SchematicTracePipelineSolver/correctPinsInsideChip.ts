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
