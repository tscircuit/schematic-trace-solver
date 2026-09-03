import type { InputChip, InputPin } from "lib/types/InputProblem"

export type PinDirection = "x+" | "x-" | "y+" | "y-"

export const getPinDirectionCandidates = (
  pin: InputPin,
  chip: InputChip,
  connectedPin?: InputPin,
): PinDirection[] => {
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

  // Preserve the established single-direction result as the primary choice.
  // Candidate routing may treat nearly equal edge distances as an ambiguous
  // corner, but context-free callers (such as visualization) should not change
  // direction solely because the candidate comparison uses a tolerance.
  const primaryDirection: PinDirection =
    minDistance === yPlusDistance
      ? "y+"
      : minDistance === yMinusDistance
        ? "y-"
        : minDistance === xPlusDistance
          ? "x+"
          : "x-"

  const matchingDirections = [
    { direction: "y+" as const, distance: yPlusDistance },
    { direction: "y-" as const, distance: yMinusDistance },
    { direction: "x+" as const, distance: xPlusDistance },
    { direction: "x-" as const, distance: xMinusDistance },
  ]
    .filter(({ distance }) => Math.abs(distance - minDistance) <= 1e-9)
    .map(({ direction }) => direction)

  const closestDirections = [
    primaryDirection,
    ...matchingDirections.filter((direction) => direction !== primaryDirection),
  ]

  if (!connectedPin || closestDirections.length <= 1) {
    return closestDirections
  }

  const xDistance = connectedPin.x - pin.x
  const yDistance = connectedPin.y - pin.y
  const directionTowardConnectedPin: PinDirection =
    Math.abs(xDistance) >= Math.abs(yDistance)
      ? xDistance >= 0
        ? "x+"
        : "x-"
      : yDistance >= 0
        ? "y+"
        : "y-"

  if (!closestDirections.includes(directionTowardConnectedPin)) {
    return closestDirections
  }

  return [
    directionTowardConnectedPin,
    ...closestDirections.filter(
      (direction) => direction !== directionTowardConnectedPin,
    ),
  ]
}

export const getPinDirection = (
  pin: InputPin,
  chip: InputChip,
  connectedPin?: InputPin,
): PinDirection => getPinDirectionCandidates(pin, chip, connectedPin)[0]!
