import { dir, type FacingDirection } from "../../utils/dir"
import {
  DEFAULT_TRACE_CLEARANCE,
  tracePointsMatch,
} from "../../utils/traceRouting"
import type {
  InputChip,
  InputPin,
  InputProblem,
  PinId,
} from "../../types/InputProblem"
import { getInputChipBounds } from "../GuidelinesSolver/getInputChipBounds"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getPinDirection } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"

type OriginalPin = Pick<InputPin, "x" | "y"> & {
  _facingDirection: FacingDirection
}
type OriginalPinById = Partial<Record<PinId, OriginalPin>>

export const getOriginalPinById = (
  inputProblem: InputProblem,
): OriginalPinById => {
  const originalPinById: OriginalPinById = {}
  for (const chip of inputProblem.chips) {
    for (const pin of chip.pins) {
      const facingDirection = pin._facingDirection
      if (!facingDirection) continue
      originalPinById[pin.pinId] = {
        x: pin.x,
        y: pin.y,
        _facingDirection: facingDirection,
      }
    }
  }
  return originalPinById
}

const restoreEndpoint = ({
  tracePath,
  atStart,
  originalPin,
  routingChip,
}: {
  tracePath: SolvedTracePath["tracePath"]
  atStart: boolean
  originalPin: OriginalPin
  routingChip: InputProblem["chips"][number]
}) => {
  const adjacentPoint = tracePath[atStart ? 1 : tracePath.length - 2]
  if (!adjacentPoint) return tracePath

  const bounds = getInputChipBounds(routingChip)
  const outward = dir(originalPin._facingDirection)
  const originalPoint = { x: originalPin.x, y: originalPin.y }
  const approachPoint = {
    x: outward.x
      ? (outward.x < 0 ? bounds.minX : bounds.maxX) +
        outward.x * DEFAULT_TRACE_CLEARANCE
      : originalPin.x,
    y: outward.y
      ? (outward.y < 0 ? bounds.minY : bounds.maxY) +
        outward.y * DEFAULT_TRACE_CLEARANCE
      : originalPin.y,
  }
  const cornerPoint = outward.x
    ? { x: approachPoint.x, y: adjacentPoint.y }
    : { x: adjacentPoint.x, y: approachPoint.y }
  const retainedPath = atStart ? tracePath.slice(1) : tracePath.slice(0, -1)
  return simplifyPath(
    atStart
      ? [originalPoint, approachPoint, cornerPoint, ...retainedPath]
      : [...retainedPath, cornerPoint, approachPoint, originalPoint],
  )
}

export const restoreOriginalTraceEndpoints = ({
  traces,
  routingChipById,
  originalPinById,
}: {
  traces: SolvedTracePath[]
  routingChipById: Record<string, InputChip>
  originalPinById: OriginalPinById
}) => {
  return traces.map((trace) => {
    let tracePath = [...trace.tracePath]
    const pins = [...trace.pins] as SolvedTracePath["pins"]

    for (const [pinIndex, routingPin] of trace.pins.entries()) {
      const atStart = tracePointsMatch(routingPin, tracePath[0]!)
      const atEnd = tracePointsMatch(routingPin, tracePath.at(-1)!)
      if (!atStart && !atEnd) continue

      const originalPin = originalPinById[routingPin.pinId]
      const routingChip = routingChipById[routingPin.chipId]
      if (!originalPin || !routingChip) continue

      const routingDirection =
        routingPin._facingDirection ?? getPinDirection(routingPin, routingChip)
      if (
        originalPin._facingDirection[0] === routingDirection[0] ||
        tracePointsMatch(routingPin, originalPin)
      ) {
        continue
      }

      tracePath = restoreEndpoint({
        tracePath,
        atStart,
        originalPin,
        routingChip,
      })
      pins[pinIndex] = { ...routingPin, x: originalPin.x, y: originalPin.y }
    }

    return { ...trace, pins, tracePath }
  })
}
