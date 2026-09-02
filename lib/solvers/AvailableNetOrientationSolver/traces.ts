import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { pointsEqual } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputPin, InputProblem } from "lib/types/InputProblem"
import { EPS } from "./constants"
import type { CandidateLabel } from "./types"

export const extendTracePathAtInteriorPoint = ({
  tracePath,
  sourcePoint,
  extensionEndPoint,
}: {
  tracePath: Point[]
  sourcePoint: Point
  extensionEndPoint: Point
}) => {
  const sourceIndex = tracePath.findIndex((point) =>
    pointsEqual(point, sourcePoint),
  )
  if (sourceIndex <= 0 || sourceIndex >= tracePath.length - 1) return null

  const previousPoint = tracePath[sourceIndex - 1]!
  const nextPoint = tracePath[sourceIndex + 1]!
  const extensionDirectionY = extensionEndPoint.y - sourcePoint.y
  const previousContinuesOppositeExtension =
    Math.abs(previousPoint.x - sourcePoint.x) <= EPS &&
    (previousPoint.y - sourcePoint.y) * extensionDirectionY < 0

  if (previousContinuesOppositeExtension) {
    return [
      ...tracePath.slice(0, sourceIndex),
      extensionEndPoint,
      ...tracePath.slice(sourceIndex),
    ]
  }

  const nextContinuesOppositeExtension =
    Math.abs(nextPoint.x - sourcePoint.x) <= EPS &&
    (nextPoint.y - sourcePoint.y) * extensionDirectionY < 0
  if (!nextContinuesOppositeExtension) return null

  return [
    ...tracePath.slice(0, sourceIndex + 1),
    extensionEndPoint,
    ...tracePath.slice(sourceIndex + 1),
  ]
}

export const getPinMap = (inputProblem: InputProblem) => {
  const pinMap: Record<string, InputPin & { chipId: string }> = {}
  for (const chip of inputProblem.chips) {
    for (const pin of chip.pins) {
      pinMap[pin.pinId] = { ...pin, chipId: chip.chipId }
    }
  }
  return pinMap
}

export const getTracePins = (
  label: NetLabelPlacement,
  pinMap: Record<string, InputPin & { chipId: string }>,
): SolvedTracePath["pins"] => {
  const pins = label.pinIds.flatMap((pinId) => {
    const pin = pinMap[pinId]
    return pin ? [pin] : []
  })

  if (pins.length >= 2) return [pins[0]!, pins[1]!]
  if (pins.length === 1) return [pins[0]!, pins[0]!]

  const syntheticPin = {
    pinId: `${label.globalConnNetId}-netlabel-anchor`,
    x: label.anchorPoint.x,
    y: label.anchorPoint.y,
    chipId: "available-net-orientation",
  }
  return [syntheticPin, syntheticPin]
}

export const toNetLabelPlacementPatch = (candidate: CandidateLabel) => ({
  orientation: candidate.orientation,
  anchorPoint: candidate.anchorPoint,
  center: candidate.center,
  width: candidate.width,
  height: candidate.height,
})
