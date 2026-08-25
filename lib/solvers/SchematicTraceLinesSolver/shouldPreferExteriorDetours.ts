import type { InputProblem } from "lib/types/InputProblem"
import type { MspConnectionPair } from "../MspConnectionPairSolver/MspConnectionPairSolver"

export const shouldPreferExteriorDetours = ({
  connectionPair,
  allConnectionPairs,
  inputProblem,
}: {
  connectionPair: MspConnectionPair
  allConnectionPairs: MspConnectionPair[]
  inputProblem: InputProblem
}) => {
  const [firstPin, secondPin] = connectionPair.pins
  const belongsToNetConnection = inputProblem.netConnections.some(
    (netConnection) =>
      netConnection.pinIds.includes(firstPin.pinId) &&
      netConnection.pinIds.includes(secondPin.pinId),
  )
  if (belongsToNetConnection) return true

  return allConnectionPairs.some((otherPair) => {
    if (otherPair === connectionPair) return false

    const [otherFirstPin, otherSecondPin] = otherPair.pins
    const sameOrder =
      firstPin.chipId === otherFirstPin.chipId &&
      secondPin.chipId === otherSecondPin.chipId
    if (sameOrder) return true

    return (
      firstPin.chipId === otherSecondPin.chipId &&
      secondPin.chipId === otherFirstPin.chipId
    )
  })
}
