import type { InputChip, InputProblem } from "../../../types/InputProblem"
import { getInputChipBounds } from "../../GuidelinesSolver/getInputChipBounds"

export type ChipWithBounds = {
  chipId: string
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const chipToRect = (chip: InputChip): ChipWithBounds => {
  const b = getInputChipBounds(chip)
  return { chipId: chip.chipId, ...b }
}

export const getObstacleRects = (problem: InputProblem): ChipWithBounds[] => {
  return problem.chips.map(chipToRect)
}
