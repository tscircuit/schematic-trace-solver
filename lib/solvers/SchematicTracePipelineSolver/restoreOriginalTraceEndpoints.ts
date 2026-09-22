import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputPin, InputProblem, PinId } from "../../types/InputProblem"

const ENDPOINT_EPSILON = 1e-9

const getPinsById = (problem: InputProblem): Partial<Record<PinId, InputPin>> =>
  Object.fromEntries(
    problem.chips.flatMap((chip) => chip.pins.map((pin) => [pin.pinId, pin])),
  )

const pointsMatch = (first: Point, second: Point) =>
  Math.abs(first.x - second.x) <= ENDPOINT_EPSILON &&
  Math.abs(first.y - second.y) <= ENDPOINT_EPSILON

const restorePinPosition = ({
  pin,
  restoredPinIds,
  originalPinsById,
}: {
  pin: SolvedTracePath["pins"][number]
  restoredPinIds: Set<PinId>
  originalPinsById: Partial<Record<PinId, InputPin>>
}) => {
  const originalPin = originalPinsById[pin.pinId]
  if (!restoredPinIds.has(pin.pinId) || !originalPin) return pin
  return { ...pin, x: originalPin.x, y: originalPin.y }
}

export const restoreOriginalTraceEndpoints = ({
  traces,
  routingProblem,
  originalProblem,
}: {
  traces: SolvedTracePath[]
  routingProblem: InputProblem
  originalProblem: InputProblem
}) => {
  const routingPinsById = getPinsById(routingProblem)
  const originalPinsById = getPinsById(originalProblem)

  const restoredTraces = traces.map((trace) => {
    const tracePath = [...trace.tracePath]
    const restoredPinIds = new Set<PinId>()

    for (const endpointIndex of [0, tracePath.length - 1]) {
      const endpoint = tracePath[endpointIndex]
      if (!endpoint) continue

      // Directed pins can be moved to an obstacle edge for routing. Once all
      // collision-sensitive work is complete, extend that terminal segment
      // back to the caller's real port coordinate.
      const pinId = trace.pinIds.find((candidatePinId) => {
        const routingPin = routingPinsById[candidatePinId]
        const originalPin = originalPinsById[candidatePinId]
        return (
          routingPin &&
          originalPin?._facingDirection &&
          !pointsMatch(routingPin, originalPin) &&
          pointsMatch(endpoint, routingPin)
        )
      })
      const originalPin = pinId ? originalPinsById[pinId] : undefined
      if (!pinId || !originalPin) continue

      tracePath[endpointIndex] = { x: originalPin.x, y: originalPin.y }
      restoredPinIds.add(pinId)
    }

    const pins: SolvedTracePath["pins"] = [
      restorePinPosition({
        pin: trace.pins[0],
        restoredPinIds,
        originalPinsById,
      }),
      restorePinPosition({
        pin: trace.pins[1],
        restoredPinIds,
        originalPinsById,
      }),
    ]

    return { ...trace, pins, tracePath }
  })

  return restoredTraces
}
