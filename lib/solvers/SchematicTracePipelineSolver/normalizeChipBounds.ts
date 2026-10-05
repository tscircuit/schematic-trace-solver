import { getBoundsCenter } from "@tscircuit/math-utils"
import type { InputProblem } from "lib/types/InputProblem"

/** Use supplied drawn-body bounds, retaining pin-inclusive sizing for legacy inputs. */
export const normalizeChipBounds = (problem: InputProblem) => {
  for (const chip of problem.chips) {
    if (chip.bodyBounds) {
      chip.center = getBoundsCenter(chip.bodyBounds)
      chip.width = chip.bodyBounds.maxX - chip.bodyBounds.minX
      chip.height = chip.bodyBounds.maxY - chip.bodyBounds.minY
      continue
    }
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
    }
  }
}
