import type { InputProblem } from "lib/types/InputProblem"

/**
 * Expands chip width/height (never shrinks) so that all existing pin coordinates
 * are inside or on the chip boundary, and any pin at the furthest extent in X/Y
 * lies exactly on an edge.
 *
 * Notes:
 * - Center is preserved.
 * - Only increases dimensions as needed.
 * - Clears cached _facingDirection on pins since geometry changed.
 */
export const expandChipsToFitPins = (problem: InputProblem) => {
  for (const chip of problem.chips) {
    const halfWidth = chip.width / 2
    const halfHeight = chip.height / 2

    let maxDx = 0
    let maxDy = 0

    for (const pin of chip.pins) {
      const dx = Math.abs(pin.x - chip.center.x)
      const dy = Math.abs(pin.y - chip.center.y)
      if (dx > maxDx) maxDx = dx
      if (dy > maxDy) maxDy = dy
    }

    const newHalfWidth = Math.max(halfWidth, maxDx)
    const newHalfHeight = Math.max(halfHeight, maxDy)

    if (newHalfWidth > halfWidth || newHalfHeight > halfHeight) {
      chip.width = newHalfWidth * 2
      chip.height = newHalfHeight * 2

      // Clear any cached facing direction since geometry changed.
      for (const pin of chip.pins) {
        pin._facingDirection = undefined
      }
    }
  }
}
