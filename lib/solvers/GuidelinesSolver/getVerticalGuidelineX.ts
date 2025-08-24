import type { ChipBounds } from "./getInputChipBounds"

export function getVerticalGuidelineX(
  chip1Bounds: ChipBounds,
  chip2Bounds: ChipBounds,
): number {
  if (chip1Bounds.maxX <= chip2Bounds.minX) {
    return (chip1Bounds.maxX + chip2Bounds.minX) / 2
  }
  
  if (chip2Bounds.maxX <= chip1Bounds.minX) {
    return (chip2Bounds.maxX + chip1Bounds.minX) / 2
  }
  
  const overlapMinX = Math.max(chip1Bounds.minX, chip2Bounds.minX)
  const overlapMaxX = Math.min(chip1Bounds.maxX, chip2Bounds.maxX)
  return (overlapMinX + overlapMaxX) / 2
}