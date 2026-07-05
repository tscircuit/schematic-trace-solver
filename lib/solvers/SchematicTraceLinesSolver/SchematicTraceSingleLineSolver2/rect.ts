import type { InputChip, InputProblem } from "lib/types/InputProblem"
import { getInputChipBounds } from "lib/solvers/GuidelinesSolver/getInputChipBounds"
import { getTextBoxBounds, type RectPadding } from "lib/utils/textBoxBounds"

export type ChipWithBounds = {
  chipId: string
  minX: number
  minY: number
  maxX: number
  maxY: number
  isTextBox?: boolean
}

export const chipToRect = (chip: InputChip): ChipWithBounds => {
  const b = getInputChipBounds(chip)
  return { chipId: chip.chipId, ...b }
}

export const getObstacleRects = (
  problem: InputProblem,
  opts: { textBoxPadding?: RectPadding } = {},
): ChipWithBounds[] => {
  const chipRects = problem.chips.map(chipToRect)
  const textBoxRects = (problem.textBoxes ?? []).map((textBox, index) => {
    const b = getTextBoxBounds(textBox, opts.textBoxPadding)
    return {
      chipId: `text_box_${index}${textBox.chipId ? `_${textBox.chipId}` : ""}`,
      isTextBox: true,
      ...b,
    }
  })

  return [...chipRects, ...textBoxRects]
}
