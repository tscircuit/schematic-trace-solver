import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type {
  ChipId,
  InputChip,
  InputPin,
  InputProblem,
  PinId,
} from "../../types/InputProblem"
import { getInputChipBounds } from "../GuidelinesSolver/getInputChipBounds"
import { getPinDirection } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import { dir, type FacingDirection } from "../../utils/dir"
import {
  DEFAULT_TRACE_CLEARANCE,
  removeConsecutiveDuplicateTracePoints,
  traceCoordinatesMatch,
  tracePointsMatch,
} from "../../utils/traceRouting"

type OriginalPin = Pick<InputPin, "x" | "y" | "_facingDirection">
export type OriginalPinById = Partial<Record<PinId, OriginalPin>>

export const getOriginalPinById = (
  inputProblem: InputProblem,
): OriginalPinById =>
  Object.fromEntries(
    inputProblem.chips.flatMap((chip) =>
      chip.pins.map((pin) => [
        pin.pinId,
        { x: pin.x, y: pin.y, _facingDirection: pin._facingDirection },
      ]),
    ),
  )

const restoreTracePathEndpoint = ({
  tracePath,
  atStart,
  originalPin,
  routingChip,
  facingDirection,
}: {
  tracePath: Point[]
  atStart: boolean
  originalPin: OriginalPin
  routingChip: InputChip
  facingDirection: FacingDirection
}) => {
  const adjacentPoint = tracePath[atStart ? 1 : tracePath.length - 2]
  const previousPoint = tracePath[atStart ? 2 : tracePath.length - 3]
  if (!adjacentPoint) return tracePath

  const bounds = getInputChipBounds(routingChip)
  const outward = dir(facingDirection)
  const approachPoint = { x: originalPin.x, y: originalPin.y }
  if (outward.x) {
    approachPoint.x =
      (outward.x < 0 ? bounds.minX : bounds.maxX) +
      outward.x * DEFAULT_TRACE_CLEARANCE
  }
  if (outward.y) {
    approachPoint.y =
      (outward.y < 0 ? bounds.minY : bounds.maxY) +
      outward.y * DEFAULT_TRACE_CLEARANCE
  }

  const horizontalTerminal = facingDirection[0] === "x"
  const cornerPoint = horizontalTerminal
    ? { x: approachPoint.x, y: adjacentPoint.y }
    : { x: adjacentPoint.x, y: approachPoint.y }
  const replaceAdjacentPoint =
    previousPoint !== undefined &&
    traceCoordinatesMatch(
      horizontalTerminal ? previousPoint.y : previousPoint.x,
      horizontalTerminal ? adjacentPoint.y : adjacentPoint.x,
    )
  const retainedPath = atStart
    ? tracePath.slice(replaceAdjacentPoint ? 2 : 1)
    : tracePath.slice(0, replaceAdjacentPoint ? -2 : -1)
  const originalPoint = { x: originalPin.x, y: originalPin.y }

  return removeConsecutiveDuplicateTracePoints(
    atStart
      ? [originalPoint, approachPoint, cornerPoint, ...retainedPath]
      : [...retainedPath, cornerPoint, approachPoint, originalPoint],
  )
}

export const restoreOriginalTraceEndpoints = ({
  traces,
  routingProblem,
  originalPinById,
}: {
  traces: SolvedTracePath[]
  routingProblem: InputProblem
  originalPinById: OriginalPinById
}) => {
  const routingChipById: Partial<Record<ChipId, InputChip>> =
    Object.fromEntries(routingProblem.chips.map((chip) => [chip.chipId, chip]))

  return traces.map((trace) => {
    let tracePath = [...trace.tracePath]
    const restoredPinIds = new Set<PinId>()

    for (const atStart of [true, false]) {
      const endpoint = atStart ? tracePath[0] : tracePath.at(-1)
      if (!endpoint) continue
      const routingPin = trace.pins.find((pin) =>
        tracePointsMatch(pin, endpoint),
      )
      const originalPin = routingPin
        ? originalPinById[routingPin.pinId]
        : undefined
      const routingChip = routingPin
        ? routingChipById[routingPin.chipId]
        : undefined
      const facingDirection = originalPin?._facingDirection
      if (!routingPin || !originalPin || !routingChip || !facingDirection) {
        continue
      }

      const routingFacingDirection =
        routingPin._facingDirection ?? getPinDirection(routingPin, routingChip)
      if (
        facingDirection[0] === routingFacingDirection[0] ||
        tracePointsMatch(routingPin, originalPin)
      ) {
        continue
      }

      tracePath = restoreTracePathEndpoint({
        tracePath,
        atStart,
        originalPin,
        routingChip,
        facingDirection,
      })
      restoredPinIds.add(routingPin.pinId)
    }

    const restoredPins = trace.pins.map((routingPin) => {
      const originalPin = originalPinById[routingPin.pinId]
      return restoredPinIds.has(routingPin.pinId) && originalPin
        ? { ...routingPin, x: originalPin.x, y: originalPin.y }
        : routingPin
    }) as SolvedTracePath["pins"]

    return { ...trace, pins: restoredPins, tracePath }
  })
}
