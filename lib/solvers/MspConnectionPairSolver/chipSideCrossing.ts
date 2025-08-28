import type { InputPin, InputChip } from "lib/types/InputProblem"
import { getInputChipBounds } from "../GuidelinesSolver/getInputChipBounds"

export type PinSide = "left" | "right" | "top" | "bottom" | "unknown"

/**
 * Determines which side of a chip a pin is on based on its position
 * relative to the chip's bounds. For pins outside the chip (typical in schematics),
 * determines which side they are closest to.
 */
export function getPinSideOnChip(pin: InputPin, chip: InputChip): PinSide {
  const bounds = getInputChipBounds(chip)
  const tolerance = 1e-6

  // Check if pin is on the boundary within tolerance
  const onLeft = Math.abs(pin.x - bounds.minX) < tolerance
  const onRight = Math.abs(pin.x - bounds.maxX) < tolerance
  const onTop = Math.abs(pin.y - bounds.maxY) < tolerance
  const onBottom = Math.abs(pin.y - bounds.minY) < tolerance

  // Prefer vertical sides over horizontal for corner cases
  if (onLeft) return "left"
  if (onRight) return "right"
  if (onTop) return "top"
  if (onBottom) return "bottom"

  // For pins outside the chip bounds, determine which side they're closest to
  const centerX = chip.center.x
  const centerY = chip.center.y

  // Calculate distances to each side
  const distToLeft = Math.abs(pin.x - bounds.minX)
  const distToRight = Math.abs(pin.x - bounds.maxX)
  const distToTop = Math.abs(pin.y - bounds.maxY)
  const distToBottom = Math.abs(pin.y - bounds.minY)

  // Check if pin is primarily to one side of the chip center
  const isLeftOfCenter = pin.x < centerX
  const isRightOfCenter = pin.x > centerX
  const isAboveCenter = pin.y > centerY
  const isBelowCenter = pin.y < centerY

  // For pins outside chip bounds, prefer the side they're on relative to center
  // and closest to in terms of boundary distance
  if (isLeftOfCenter && distToLeft <= distToRight) {
    return "left"
  }
  if (isRightOfCenter && distToRight <= distToLeft) {
    return "right"
  }
  if (isAboveCenter && distToTop <= distToBottom) {
    return "top"
  }
  if (isBelowCenter && distToBottom <= distToTop) {
    return "bottom"
  }

  // Fallback: use minimum distance to any boundary
  const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom)
  if (minDist === distToLeft) return "left"
  if (minDist === distToRight) return "right"
  if (minDist === distToTop) return "top"
  if (minDist === distToBottom) return "bottom"

  return "unknown"
}

/**
 * Checks if two pins on the same chip would require a trace
 * to cross through the chip body (i.e., they are on opposite sides).
 */
export function wouldCrossChip(
  pin1: InputPin & { chipId: string },
  pin2: InputPin & { chipId: string },
  chipMap: Record<string, InputChip>,
): boolean {
  // Only check if both pins are on the same chip
  if (pin1.chipId !== pin2.chipId) {
    return false
  }

  const chip = chipMap[pin1.chipId]
  if (!chip) {
    return false
  }

  const side1 = getPinSideOnChip(pin1, chip)
  const side2 = getPinSideOnChip(pin2, chip)

  // If either pin side is unknown, be conservative and allow connection
  if (side1 === "unknown" || side2 === "unknown") {
    return false
  }

  // Check for opposite sides
  const isOpposite =
    (side1 === "left" && side2 === "right") ||
    (side1 === "right" && side2 === "left") ||
    (side1 === "top" && side2 === "bottom") ||
    (side1 === "bottom" && side2 === "top")

  return isOpposite
}
