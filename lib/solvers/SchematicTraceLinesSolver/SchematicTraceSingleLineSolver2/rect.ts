import { getInputChipBounds } from "lib/solvers/GuidelinesSolver/getInputChipBounds"
import type { InputChip, InputProblem } from "lib/types/InputProblem"
import { getTextBoxBounds, type RectPadding } from "lib/utils/textBoxBounds"

// Component text is normally placed 0.04 units from its chip. A trace
// centerline can fit mathematically, but its rendered stroke cannot usefully
// occupy that channel.
const MIN_ROUTABLE_OBSTACLE_GAP = 0.05

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

const rangesOverlap = (
  minA: number,
  maxA: number,
  minB: number,
  maxB: number,
) => Math.min(maxA, maxB) > Math.max(minA, minB)

const closeNarrowGapToAttachedChip = (
  textBounds: RectBounds,
  chipBounds: RectBounds,
): RectBounds => {
  const bounds = { ...textBounds }

  if (
    rangesOverlap(bounds.minX, bounds.maxX, chipBounds.minX, chipBounds.maxX)
  ) {
    const gapBelowChip = chipBounds.minY - bounds.maxY
    const gapAboveChip = bounds.minY - chipBounds.maxY
    if (gapBelowChip > 0 && gapBelowChip < MIN_ROUTABLE_OBSTACLE_GAP) {
      bounds.maxY = chipBounds.minY
    } else if (gapAboveChip > 0 && gapAboveChip < MIN_ROUTABLE_OBSTACLE_GAP) {
      bounds.minY = chipBounds.maxY
    }
  }

  if (
    rangesOverlap(bounds.minY, bounds.maxY, chipBounds.minY, chipBounds.maxY)
  ) {
    const gapLeftOfChip = chipBounds.minX - bounds.maxX
    const gapRightOfChip = bounds.minX - chipBounds.maxX
    if (gapLeftOfChip > 0 && gapLeftOfChip < MIN_ROUTABLE_OBSTACLE_GAP) {
      bounds.maxX = chipBounds.minX
    } else if (
      gapRightOfChip > 0 &&
      gapRightOfChip < MIN_ROUTABLE_OBSTACLE_GAP
    ) {
      bounds.minX = chipBounds.maxX
    }
  }

  return bounds
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
    const b = attachedChipBounds
      ? closeNarrowGapToAttachedChip(textBounds, attachedChipBounds)
      : textBounds
    return {
      kind: "text_box" as const,
      textBox,
      ...b,
    }
  })

  return [...chipRects, ...textBoxRects]
}
