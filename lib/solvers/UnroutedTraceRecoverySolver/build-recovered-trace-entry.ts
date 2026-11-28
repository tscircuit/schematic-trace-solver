import type { Point } from "@tscircuit/math-utils"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getConnectedSameNetTracesForPin } from "./get-connected-same-net-traces-for-pin"

const COORDINATE_TOLERANCE = 1e-9

export const buildRecoveredTraceEntry = ({
  connectionPair,
  recoveredPath,
  sameNetTraces,
}: {
  connectionPair: MspConnectionPair
  recoveredPath: Point[]
  sameNetTraces: readonly SolvedTracePath[]
}): SolvedTracePath => {
  const firstPoint = recoveredPath[0]
  const endPoint = recoveredPath.at(-1)
  const startPin = firstPoint
    ? connectionPair.pins.find(
        (pin) =>
          Math.abs(pin.x - firstPoint.x) <= COORDINATE_TOLERANCE &&
          Math.abs(pin.y - firstPoint.y) <= COORDINATE_TOLERANCE,
      )
    : undefined
  const otherPin = startPin
    ? connectionPair.pins.find((pin) => pin.pinId !== startPin.pinId)
    : undefined
  const endsAtOtherPin =
    otherPin !== undefined &&
    endPoint !== undefined &&
    Math.abs(endPoint.x - otherPin.x) <= COORDINATE_TOLERANCE &&
    Math.abs(endPoint.y - otherPin.y) <= COORDINATE_TOLERANCE
  const junctionHostTrace =
    !endsAtOtherPin && startPin && endPoint
      ? sameNetTraces.find((trace) =>
          tracePathContainsPoint(trace.tracePath, endPoint),
        )
      : undefined
  const firstHostPinId = junctionHostTrace?.pinIds[0]
  const joinedComponentTraces =
    firstHostPinId !== undefined
      ? getConnectedSameNetTracesForPin({
          pinId: firstHostPinId,
          sameNetTraces,
        })
      : []
  const connectsPairPins =
    endsAtOtherPin ||
    !startPin ||
    !junctionHostTrace ||
    (otherPin !== undefined &&
      joinedComponentTraces.some((trace) =>
        trace.pinIds.includes(otherPin.pinId),
      ))

  const hostPin =
    startPin && junctionHostTrace
      ? (junctionHostTrace.pins.find((pin) => pin.pinId !== startPin.pinId) ??
        junctionHostTrace.pins[0])
      : undefined

  if (connectsPairPins || !startPin || !hostPin) {
    return {
      ...connectionPair,
      tracePath: recoveredPath,
      mspConnectionPairIds: [connectionPair.mspPairId],
      pinIds: connectionPair.pins.map((pin) => pin.pinId),
    }
  }

  const mspPairId = `${hostPin.pinId}-${startPin.pinId}`
  return {
    ...connectionPair,
    mspPairId,
    pins: [hostPin, startPin],
    tracePath: recoveredPath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [hostPin.pinId, startPin.pinId],
  }
}
