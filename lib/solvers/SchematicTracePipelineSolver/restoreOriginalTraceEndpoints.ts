import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type {
  InputChip,
  InputPin,
  InputProblem,
  PinId,
} from "../../types/InputProblem"
import { getInputChipBounds } from "../GuidelinesSolver/getInputChipBounds"
import { getPinDirection } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"

const ENDPOINT_EPSILON = 1e-9
const TERMINAL_CLEARANCE = 0.2

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

const rebuildTerminalElbow = ({
  tracePath,
  endpointIndex,
  originalPin,
  routingChip,
}: {
  tracePath: Point[]
  endpointIndex: number
  originalPin: InputPin
  routingChip: InputChip
}) => {
  const isStart = endpointIndex === 0
  const path = isStart ? [...tracePath].reverse() : [...tracePath]
  const adjacentPoint = path.at(-2)
  const previousPoint = path.at(-3)
  const facing = originalPin._facingDirection!
  if (!adjacentPoint) return tracePath

  const bounds = getInputChipBounds(routingChip)
  const approachPoint: Point =
    facing === "x-"
      ? { x: bounds.minX - TERMINAL_CLEARANCE, y: originalPin.y }
      : facing === "x+"
        ? { x: bounds.maxX + TERMINAL_CLEARANCE, y: originalPin.y }
        : facing === "y-"
          ? { x: originalPin.x, y: bounds.minY - TERMINAL_CLEARANCE }
          : { x: originalPin.x, y: bounds.maxY + TERMINAL_CLEARANCE }
  const cornerPoint: Point =
    getDirectionAxis(facing) === "x"
      ? { x: approachPoint.x, y: adjacentPoint.y }
      : { x: adjacentPoint.x, y: approachPoint.y }
  const adjacentSegmentAlreadyTurnsTowardPort =
    previousPoint &&
    (getDirectionAxis(facing) === "x"
      ? pointsMatch({ x: 0, y: previousPoint.y }, { x: 0, y: adjacentPoint.y })
      : pointsMatch({ x: previousPoint.x, y: 0 }, { x: adjacentPoint.x, y: 0 }))

  path.splice(
    adjacentSegmentAlreadyTurnsTowardPort ? -2 : -1,
    adjacentSegmentAlreadyTurnsTowardPort ? 2 : 1,
    cornerPoint,
    approachPoint,
    { x: originalPin.x, y: originalPin.y },
  )

  const deduplicatedPath = path.filter(
    (point, index) => index === 0 || !pointsMatch(point, path[index - 1]!),
  )
  return isStart ? deduplicatedPath.reverse() : deduplicatedPath
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
    let tracePath = [...trace.tracePath]
    const restoredPinIds = new Set<PinId>()

    for (const endpointSide of ["start", "end"] as const) {
      const endpointIndex = endpointSide === "start" ? 0 : tracePath.length - 1
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
      const routingChip = pinId ? routingPinsById[pinId]?.chip : undefined
      if (!pinId || !originalPin || !routingChip) continue

      tracePath = rebuildTerminalElbow({
        tracePath,
        endpointIndex,
        originalPin,
        routingChip,
      })
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
