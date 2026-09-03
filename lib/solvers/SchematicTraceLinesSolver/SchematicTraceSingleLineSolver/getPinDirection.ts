import type { InputChip, InputPin } from "lib/types/InputProblem"

export const getPinDirection = (
  pin: InputPin,
  chip: InputChip,
  connectedPin?: InputPin,
): "x+" | "x-" | "y+" | "y-" => {
  // Determine what edge the pin lies on
  const { x, y } = pin
  const { center, width, height } = chip

  const yPlusEdge = center.y + height / 2
  const yMinusEdge = center.y - height / 2
  const xPlusEdge = center.x + width / 2
  const xMinusEdge = center.x - width / 2

  // Which edge is the pin closest to?
  const yPlusDistance = yPlusEdge - y
  const yMinusDistance = y - yMinusEdge
  const xPlusDistance = xPlusEdge - x
  const xMinusDistance = x - xMinusEdge

  const minDistance = Math.min(
    yPlusDistance,
    yMinusDistance,
    xPlusDistance,
    xMinusDistance,
  )

  // A thin two-terminal symbol can put a pin on two obstacle edges at once.
  // When routing a known pair, use the other endpoint to break only that tie.
  if (connectedPin && chip.pins.length === 2) {
    const closestDirections = [
      { direction: "y+" as const, distance: yPlusDistance },
      { direction: "y-" as const, distance: yMinusDistance },
      { direction: "x+" as const, distance: xPlusDistance },
      { direction: "x-" as const, distance: xMinusDistance },
    ]
      .filter(({ distance }) => Math.abs(distance - minDistance) <= 1e-9)
      .map(({ direction }) => direction)

    if (closestDirections.length > 1) {
      const xDistance = connectedPin.x - pin.x
      const yDistance = connectedPin.y - pin.y
      const directionTowardConnectedPin =
        Math.abs(xDistance) >= Math.abs(yDistance)
          ? xDistance >= 0
            ? "x+"
            : "x-"
          : yDistance >= 0
            ? "y+"
            : "y-"

      if (closestDirections.includes(directionTowardConnectedPin)) {
        return directionTowardConnectedPin
      }
    }
  }

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
