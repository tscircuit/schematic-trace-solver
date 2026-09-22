import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type {
  InputChip,
  InputPin,
  InputProblem,
  PinId,
} from "../../types/InputProblem"
import { getPinDirection } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"

const ENDPOINT_EPSILON = 1e-9

type PinContext = { pin: InputPin; chip: InputChip }

const getPinsById = (
  problem: InputProblem,
): Partial<Record<PinId, PinContext>> =>
  Object.fromEntries(
    problem.chips.flatMap((chip) =>
      chip.pins.map((pin) => [pin.pinId, { pin, chip }]),
    ),
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
  originalPinsById: Partial<Record<PinId, PinContext>>
}) => {
  const originalPin = originalPinsById[pin.pinId]?.pin
  if (!restoredPinIds.has(pin.pinId) || !originalPin) return pin
  return { ...pin, x: originalPin.x, y: originalPin.y }
}

const getDirectionAxis = (direction: "x+" | "x-" | "y+" | "y-") => direction[0]

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
        const routing = routingPinsById[candidatePinId]
        const originalPin = originalPinsById[candidatePinId]?.pin
        return (
          routing &&
          originalPin?._facingDirection &&
          getDirectionAxis(originalPin._facingDirection) !==
            getDirectionAxis(
              routing.pin._facingDirection ??
                getPinDirection(routing.pin, routing.chip),
            ) &&
          !pointsMatch(routing.pin, originalPin) &&
          pointsMatch(endpoint, routing.pin)
        )
      })
      const originalPin = pinId ? originalPinsById[pinId]?.pin : undefined
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
