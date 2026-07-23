import type { InputChip, InputProblem } from "lib/types/InputProblem"
import { getInputChipBounds } from "lib/solvers/GuidelinesSolver/getInputChipBounds"
import { getTextBoxBounds, type RectPadding } from "lib/utils/textBoxBounds"

export type RectBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type ChipObstacleRect = RectBounds & {
  kind: "chip"
  chipId: string
}

export type TextBoxObstacleRect = RectBounds & {
  kind: "text_box"
  textBox: NonNullable<InputProblem["textBoxes"]>[number]
}

export type ObstacleRect = ChipObstacleRect | TextBoxObstacleRect

export const isTextBoxObstacle = (
  obstacle: ObstacleRect,
): obstacle is TextBoxObstacleRect => obstacle.kind === "text_box"

export const chipToRect = (chip: InputChip): ChipObstacleRect => {
  const b = getInputChipBounds(chip)
  return { kind: "chip", chipId: chip.chipId, ...b }
}

export const getObstacleRects = (
  problem: InputProblem,
  opts: { textBoxPadding?: RectPadding } = {},
): ObstacleRect[] => {
  const chipRects = problem.chips.map(chipToRect)
  const textBoxRects = (problem.textBoxes ?? []).map((textBox) => {
    const b = getTextBoxBounds(textBox, opts.textBoxPadding)
    return {
      kind: "text_box" as const,
      textBox,
      ...b,
    }
  })

  return [...chipRects, ...textBoxRects]
}
