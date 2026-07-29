import { boundsDistance, type Bounds } from "@tscircuit/math-utils"
import { getInputChipBounds } from "lib/solvers/GuidelinesSolver/getInputChipBounds"
import type { InputChip, InputProblem } from "lib/types/InputProblem"
import { getTextBoxBounds, type RectPadding } from "lib/utils/textBoxBounds"

// Component text is normally placed 0.04 units from its chip. A trace
// centerline can fit mathematically, but its rendered stroke cannot usefully
// occupy that channel.
const MIN_ROUTABLE_OBSTACLE_GAP = 0.05

export type { Bounds as RectBounds } from "@tscircuit/math-utils"

export type ChipObstacleRect = Bounds & {
  kind: "chip"
  chipId: string
}

export type TextBoxObstacleRect = Bounds & {
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
    const textBounds = getTextBoxBounds(textBox, opts.textBoxPadding)
    const attachedChipBounds = chipRects.find(
      (chip) => chip.chipId === textBox.chipId,
    )
    const gap = attachedChipBounds
      ? boundsDistance(textBounds, attachedChipBounds)
      : Number.POSITIVE_INFINITY
    const b =
      attachedChipBounds && gap > 0 && gap < MIN_ROUTABLE_OBSTACLE_GAP
        ? {
            minX: Math.min(textBounds.minX, attachedChipBounds.maxX),
            maxX: Math.max(textBounds.maxX, attachedChipBounds.minX),
            minY: Math.min(textBounds.minY, attachedChipBounds.maxY),
            maxY: Math.max(textBounds.maxY, attachedChipBounds.minY),
          }
        : textBounds
    return {
      kind: "text_box" as const,
      textBox,
      ...b,
    }
  })

  return [...chipRects, ...textBoxRects]
}
