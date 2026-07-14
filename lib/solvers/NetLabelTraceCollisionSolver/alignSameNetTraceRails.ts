import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getPinDirection } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import type { FacingDirection } from "lib/utils/dir"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import type { InputChip, InputProblem } from "lib/types/InputProblem"

const EPS = 2e-3
const SIDES: FacingDirection[] = ["x-", "x+", "y-", "y+"]

type ChipBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

const getChipBounds = (chip: InputChip): ChipBounds => ({
  minX: chip.center.x - chip.width / 2,
  maxX: chip.center.x + chip.width / 2,
  minY: chip.center.y - chip.height / 2,
  maxY: chip.center.y + chip.height / 2,
})

const getExteriorRailSegmentCoordinate = (
  a: Point,
  b: Point,
  side: FacingDirection,
  bounds: ChipBounds,
): number | null => {
  if (side === "x-" || side === "x+") {
    if (Math.abs(a.x - b.x) >= EPS || Math.abs(a.y - b.y) < EPS) return null
    if (side === "x-" && a.x < bounds.minX - EPS) return a.x
    if (side === "x+" && a.x > bounds.maxX + EPS) return a.x
    return null
  }

  if (Math.abs(a.y - b.y) >= EPS || Math.abs(a.x - b.x) < EPS) return null
  if (side === "y-" && a.y < bounds.minY - EPS) return a.y
  if (side === "y+" && a.y > bounds.maxY + EPS) return a.y
  return null
}

const getRailSegmentCoordinates = (
  path: Point[],
  side: FacingDirection,
  bounds: ChipBounds,
): number[] => {
  const coordinates: number[] = []
  for (let i = 0; i < path.length - 1; i++) {
    const coordinate = getExteriorRailSegmentCoordinate(
      path[i]!,
      path[i + 1]!,
      side,
      bounds,
    )
    if (coordinate !== null) coordinates.push(coordinate)
  }
  return coordinates
}

const removeConsecutiveDuplicatePoints = (path: Point[]): Point[] =>
  path.filter(
    (point, index) =>
      index === 0 ||
      Math.abs(point.x - path[index - 1]!.x) >= EPS ||
      Math.abs(point.y - path[index - 1]!.y) >= EPS,
  )

const alignPathToRail = (
  path: Point[],
  side: FacingDirection,
  bounds: ChipBounds,
  railCoordinate: number,
): Point[] => {
  const pointIndexesToMove = new Set<number>()

  for (let i = 0; i < path.length - 1; i++) {
    if (
      getExteriorRailSegmentCoordinate(path[i]!, path[i + 1]!, side, bounds) !==
      null
    ) {
      pointIndexesToMove.add(i)
      pointIndexesToMove.add(i + 1)
    }
  }

  const alignedPath = path.map((point, index) => {
    if (!pointIndexesToMove.has(index)) return point
    return side === "x-" || side === "x+"
      ? { ...point, x: railCoordinate }
      : { ...point, y: railCoordinate }
  })

  return simplifyPath(removeConsecutiveDuplicatePoints(alignedPath))
}

const getOutermostCoordinate = (
  coordinates: number[],
  side: FacingDirection,
) => {
  if (side === "x-" || side === "y-") return Math.min(...coordinates)
  return Math.max(...coordinates)
}

export const alignSameNetTraceRails = ({
  inputProblem,
  traces,
  netLabelPlacements,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}): {
  traces: SolvedTracePath[]
  alignedRailGroupCount: number
  alignedTraceCount: number
} => {
  let outputTraces = [...traces]
  let alignedRailGroupCount = 0
  const alignedTraceIds = new Set<string>()
  const obstacles = getObstacleRects(inputProblem)

  for (const chip of inputProblem.chips) {
    const bounds = getChipBounds(chip)
    const pinMap = new Map(chip.pins.map((pin) => [pin.pinId, pin]))
    const pinSideMap = new Map(
      chip.pins.map((pin) => [
        pin.pinId,
        pin._facingDirection ?? getPinDirection(pin, chip),
      ]),
    )

    const netIds = new Set(outputTraces.map((trace) => trace.globalConnNetId))
    for (const globalConnNetId of netIds) {
      for (const side of SIDES) {
        const sameChipNetTraces = outputTraces.filter((trace) => {
          const [firstPin, secondPin] = trace.pins
          if (!firstPin || !secondPin || firstPin.pinId === secondPin.pinId)
            return false
          return (
            trace.globalConnNetId === globalConnNetId &&
            pinMap.has(firstPin.pinId) &&
            pinMap.has(secondPin.pinId)
          )
        })
        const railTraces = sameChipNetTraces.filter(
          (trace) =>
            trace.pins.some((pin) => pinSideMap.get(pin.pinId) === side) &&
            getRailSegmentCoordinates(trace.tracePath, side, bounds).length > 0,
        )
        if (railTraces.length < 2) continue

        const coordinates = railTraces.flatMap((trace) =>
          getRailSegmentCoordinates(trace.tracePath, side, bounds),
        )
        const railCoordinate = getOutermostCoordinate(coordinates, side)
        if (
          coordinates.every((value) => Math.abs(value - railCoordinate) < EPS)
        )
          continue

        const candidateTraces = railTraces.map((trace) => ({
          ...trace,
          tracePath: alignPathToRail(
            trace.tracePath,
            side,
            bounds,
            railCoordinate,
          ),
        }))
        const otherNetTraces = outputTraces.filter(
          (trace) => trace.globalConnNetId !== globalConnNetId,
        )

        const candidatesAreClear = candidateTraces.every(
          (candidate) =>
            detectTraceLabelOverlap({
              traces: [candidate],
              netLabels: netLabelPlacements,
            }).length === 0 &&
            !isPathCollidingWithObstacles(candidate.tracePath, obstacles) &&
            !doesPathCoincideWithTraces(candidate.tracePath, otherNetTraces),
        )
        if (!candidatesAreClear) continue

        const candidateMap = new Map(
          candidateTraces.map((trace) => [trace.mspPairId, trace]),
        )
        outputTraces = outputTraces.map(
          (trace) => candidateMap.get(trace.mspPairId) ?? trace,
        )
        alignedRailGroupCount++
        for (const trace of candidateTraces)
          alignedTraceIds.add(trace.mspPairId)
      }
    }
  }

  return {
    traces: outputTraces,
    alignedRailGroupCount,
    alignedTraceCount: alignedTraceIds.size,
  }
}
