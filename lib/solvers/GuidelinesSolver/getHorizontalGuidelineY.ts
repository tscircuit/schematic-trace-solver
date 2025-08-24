import type { ChipBounds } from "./getInputChipBounds"

export function getHorizontalGuidelineY(
  chip1Bounds: ChipBounds,
  chip2Bounds: ChipBounds,
): number {
  if (chip1Bounds.maxY <= chip2Bounds.minY) {
    return (chip1Bounds.maxY + chip2Bounds.minY) / 2
  }
  
  if (chip2Bounds.maxY <= chip1Bounds.minY) {
    return (chip2Bounds.maxY + chip1Bounds.minY) / 2
  }
  
  const overlapMinY = Math.max(chip1Bounds.minY, chip2Bounds.minY)
  const overlapMaxY = Math.min(chip1Bounds.maxY, chip2Bounds.maxY)
  return (overlapMinY + overlapMaxY) / 2
}