import type { GraphicsObject } from "graphics-debug"
import type { InputProblem } from "lib/types/InputProblem"

const AVAILABLE_Y_PLUS_COLOR = "#93c5fd"
const AVAILABLE_Y_MINUS_COLOR = "#fca5a5"
const AVAILABLE_ORIENTATION_FILL_ALPHA = "66"

export const colorAvailableNetOrientationLabels = (
  graphicsObject: GraphicsObject,
  inputProblem: InputProblem,
) => {
  const availableOrientations = inputProblem.availableNetLabelOrientations
  if (!availableOrientations) return

  for (const rect of graphicsObject.rects ?? []) {
    const orientations = getAvailableOrientationsForRect(
      rect.label,
      availableOrientations,
    )
    if (!orientations) continue

    const hasYPlus = orientations.includes("y+")
    const hasYMinus = orientations.includes("y-")
    if (hasYPlus === hasYMinus) continue

    const color = hasYPlus ? AVAILABLE_Y_PLUS_COLOR : AVAILABLE_Y_MINUS_COLOR

    rect.fill = `${color}${AVAILABLE_ORIENTATION_FILL_ALPHA}`
    rect.stroke = color
    rect.color = color
  }
}

const getAvailableOrientationsForRect = (
  label: string | undefined,
  availableOrientations: InputProblem["availableNetLabelOrientations"],
) => {
  for (const netId of getNetIdsFromRectLabel(label)) {
    if (Object.hasOwn(availableOrientations, netId)) {
      return availableOrientations[netId]
    }
  }

  return undefined
}

const getNetIdsFromRectLabel = (label: string | undefined) => {
  if (!label) return []

  return [
    label.match(/^netId: (.+)$/m)?.[1],
    label.match(/^globalConnNetId: (.+)$/m)?.[1],
  ].filter((netId): netId is string => Boolean(netId && netId !== "undefined"))
}
