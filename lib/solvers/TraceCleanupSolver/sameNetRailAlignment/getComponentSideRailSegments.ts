import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getPinDirection } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import type { InputChip } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"
import { getRailOrientation, RAIL_ALIGNMENT_EPSILON } from "./geometry"
import type { RailSegment } from "./types"

type UnassociatedRailSegment = Omit<
  RailSegment,
  "componentId" | "componentFacingDirection"
>

const getMovableRailSegments = (
  trace: SolvedTracePath,
): UnassociatedRailSegment[] => {
  const segments: UnassociatedRailSegment[] = []
  const path = trace.tracePath

  for (let segmentIndex = 1; segmentIndex < path.length - 2; segmentIndex++) {
    const previous = path[segmentIndex - 1]!
    const start = path[segmentIndex]!
    const end = path[segmentIndex + 1]!
    const next = path[segmentIndex + 2]!
    const orientation = getRailOrientation(start, end)
    if (!orientation) continue

    const previousOrientation = getRailOrientation(previous, start)
    const nextOrientation = getRailOrientation(end, next)
    if (!previousOrientation || !nextOrientation) continue
    if (previousOrientation === orientation || nextOrientation === orientation)
      continue

    const alongValues =
      orientation === "vertical" ? [start.y, end.y] : [start.x, end.x]
    segments.push({
      traceId: trace.mspPairId,
      segmentIndex,
      globalConnNetId: trace.globalConnNetId,
      orientation,
      coordinate: orientation === "vertical" ? start.x : start.y,
      minAlong: Math.min(...alongValues),
      maxAlong: Math.max(...alongValues),
    })
  }

  return segments
}

const railIsOutsideComponent = (
  segment: UnassociatedRailSegment,
  chip: InputChip,
  facingDirection: FacingDirection,
) => {
  const minX = chip.center.x - chip.width / 2
  const maxX = chip.center.x + chip.width / 2
  const minY = chip.center.y - chip.height / 2
  const maxY = chip.center.y + chip.height / 2

  switch (facingDirection) {
    case "x-":
      return (
        segment.orientation === "vertical" &&
        segment.coordinate <= minX + RAIL_ALIGNMENT_EPSILON
      )
    case "x+":
      return (
        segment.orientation === "vertical" &&
        segment.coordinate >= maxX - RAIL_ALIGNMENT_EPSILON
      )
    case "y+":
      return (
        segment.orientation === "horizontal" &&
        segment.coordinate >= maxY - RAIL_ALIGNMENT_EPSILON
      )
    case "y-":
      return (
        segment.orientation === "horizontal" &&
        segment.coordinate <= minY + RAIL_ALIGNMENT_EPSILON
      )
  }
}

/** Associates each movable internal rail with the nearest component endpoint. */
export const getComponentSideRailSegments = (
  trace: SolvedTracePath,
  chipMap: Map<string, InputChip>,
): RailSegment[] => {
  const segments: RailSegment[] = []

  for (const segment of getMovableRailSegments(trace)) {
    const associations = trace.pins.flatMap((pin, pinIndex) => {
      const chip = chipMap.get(pin.chipId)
      if (!chip) return []

      const componentFacingDirection =
        pin._facingDirection ?? getPinDirection(pin, chip)
      if (!railIsOutsideComponent(segment, chip, componentFacingDirection)) {
        return []
      }

      return [
        {
          componentId: chip.chipId,
          componentFacingDirection,
          distanceFromEndpoint:
            pinIndex === 0
              ? segment.segmentIndex
              : trace.tracePath.length - 2 - segment.segmentIndex,
        },
      ]
    })

    associations.sort((a, b) => a.distanceFromEndpoint - b.distanceFromEndpoint)
    const association = associations[0]
    if (!association) continue

    segments.push({ ...segment, ...association })
  }

  return segments
}
