import type { Bounds } from "@tscircuit/math-utils"
import type { InputProblem, TextBoxes } from "lib/types/InputProblem"

export type RectPadding = {
  minX?: number
  minY?: number
  maxX?: number
  maxY?: number
}

export function getTextBoxBounds(
  textBox: TextBoxes,
  padding: RectPadding = {},
): Bounds {
  return {
    minX: textBox.center.x - textBox.width / 2 - (padding.minX ?? 0),
    minY: textBox.center.y - textBox.height / 2 - (padding.minY ?? 0),
    maxX: textBox.center.x + textBox.width / 2 + (padding.maxX ?? 0),
    maxY: textBox.center.y + textBox.height / 2 + (padding.maxY ?? 0),
  }
}

export function boundsOverlap(a: Bounds, b: Bounds, eps = 1e-9): boolean {
  return (
    a.minX < b.maxX - eps &&
    a.maxX > b.minX + eps &&
    a.minY < b.maxY - eps &&
    a.maxY > b.minY + eps
  )
}

export function rectIntersectsAnyTextBox(
  bounds: Bounds,
  inputProblem: InputProblem,
): boolean {
  for (const textBox of inputProblem.textBoxes ?? []) {
    if (boundsOverlap(bounds, getTextBoxBounds(textBox))) return true
  }
  return false
}
