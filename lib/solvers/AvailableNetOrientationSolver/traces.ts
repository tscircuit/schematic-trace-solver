import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isVertical,
  pointsEqual,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputPin, InputProblem } from "lib/types/InputProblem"
import type { CandidateLabel } from "./types"

export const extendVerticalTracePathAtInteriorPoint = ({
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

  const extensionDirectionY = extensionEndPoint.y - sourcePoint.y
  const adjacentIndex = [sourceIndex - 1, sourceIndex + 1].find((index) => {
    const point = tracePath[index]!
    return (
      isVertical(point, sourcePoint) &&
      (point.y - sourcePoint.y) * extensionDirectionY < 0
    )
  })
  if (adjacentIndex === undefined) return null

  return tracePath.toSpliced(
    Math.max(sourceIndex, adjacentIndex),
    0,
    extensionEndPoint,
  )
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
