import type { InputChip } from "lib/types/InputProblem"

export interface ChipBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function getInputChipBounds(chip: InputChip): ChipBounds {
  const halfWidth = chip.width / 2
  const halfHeight = chip.height / 2
  
  return {
    minX: chip.center.x - halfWidth,
    maxX: chip.center.x + halfWidth,
    minY: chip.center.y - halfHeight,
    maxY: chip.center.y + halfHeight,
  }
}