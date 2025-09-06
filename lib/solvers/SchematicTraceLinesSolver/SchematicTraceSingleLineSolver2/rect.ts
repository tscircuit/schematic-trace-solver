import type { InputChip, InputProblem } from "lib/types/InputProblem"
import { getInputChipBounds } from "lib/solvers/GuidelinesSolver/getInputChipBounds"

export type Rect = {
  id: string
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const chipToRect = (chip: InputChip): Rect => {
  const b = getInputChipBounds(chip)
  return { id: chip.chipId, ...b }
}

export const getObstacleRects = (problem: InputProblem): Rect[] => {
  return problem.chips.map(chipToRect)
}
