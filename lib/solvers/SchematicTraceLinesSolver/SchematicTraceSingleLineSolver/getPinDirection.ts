import type { InputChip, InputPin } from "lib/types/InputProblem"

export const getPinDirection = (
  pin: InputPin,
  chip: InputChip,
): "x+" | "x-" | "y+" | "y-" => {
  // Determine what edge the pin lies on
  const { x, y } = pin
  const { center, width, height } = chip

  const yPlusEdge = center.y + height / 2
  const yMinusEdge = center.y - height / 2
  const xPlusEdge = center.x + width / 2
  const xMinusEdge = center.x - width / 2

  // Which edge is the pin closest to?
  const yPlusDistance = Math.abs(y - yPlusEdge)
  const yMinusDistance = Math.abs(y - yMinusEdge)
  const xPlusDistance = Math.abs(x - xPlusEdge)
  const xMinusDistance = Math.abs(x - xMinusEdge)

  const minDistance = Math.min(
    yPlusDistance,
    yMinusDistance,
    xPlusDistance,
    xMinusDistance,
  )

  if (minDistance === yPlusDistance) {
    return "y+"
  }

  if (minDistance === yMinusDistance) {
    return "y-"
  }

  if (minDistance === xPlusDistance) {
    return "x+"
  }

  return "x-"
}
