import type { InputProblem } from "lib/types/InputProblem"
import { getInputChipBounds } from "./getInputChipBounds"

export const getInputProblemBounds = (inputProblem: InputProblem) => {
  const bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  }
  for (const chip of inputProblem.chips) {
    const chipBounds = getInputChipBounds(chip)
    bounds.minX = Math.min(bounds.minX, chipBounds.minX)
    bounds.maxX = Math.max(bounds.maxX, chipBounds.maxX)
    bounds.minY = Math.min(bounds.minY, chipBounds.minY)
    bounds.maxY = Math.max(bounds.maxY, chipBounds.maxY)
  }
  return bounds
}
