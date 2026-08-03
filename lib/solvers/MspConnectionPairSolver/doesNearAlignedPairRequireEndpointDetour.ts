import type { Point } from "@tscircuit/math-utils"
import { getPinDirection } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import { getInitialTracePathCandidates } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/getInitialTracePath"
import {
  segmentIntersectsRect,
  segmentOverlapsRectBoundary,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { chipToRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputChip, InputPin } from "lib/types/InputProblem"

type PinWithChip = InputPin & { chipId: string }

// Half of the common 0.2 schematic pin pitch: within this band, same-facing
// pins read as a single straight run rather than an intentionally offset pair.
const MAX_NEAR_ALIGNED_OFFSET = 0.1

const samePoint = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) <= 1e-9 && Math.abs(a.y - b.y) <= 1e-9

const pathCrossesEndpointChip = ({
  path,
  pins,
  chipMap,
}: {
  path: Point[]
  pins: [PinWithChip, PinWithChip]
  chipMap: Record<string, InputChip>
}) => {
  const endpointChipIds = new Set(pins.map((pin) => pin.chipId))

  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]!
    const end = path[i + 1]!

    for (const chipId of endpointChipIds) {
      const endpointChip = chipMap[chipId]
      if (!endpointChip) continue

      const endpointRect = chipToRect(endpointChip)
      const touchesPin = pins
        .filter((pin) => pin.chipId === chipId)
        .some((pin) => samePoint(start, pin) || samePoint(end, pin))
      if (touchesPin && segmentOverlapsRectBoundary(start, end, endpointRect)) {
        continue
      }
      if (segmentIntersectsRect(start, end, endpointRect)) {
        return true
      }
    }
  }

  return false
}

/**
 * Returns true when a visually near-aligned, same-facing pin pair has no
 * supported initial path that avoids crossing an endpoint component.
 */
export const doesNearAlignedPairRequireEndpointDetour = ({
  p1,
  p2,
  chipMap,
}: {
  p1: PinWithChip
  p2: PinWithChip
  chipMap: Record<string, InputChip>
}) => {
  const pin1 = {
    ...p1,
    _facingDirection:
      p1._facingDirection ?? getPinDirection(p1, chipMap[p1.chipId]!),
  }
  const pin2 = {
    ...p2,
    _facingDirection:
      p2._facingDirection ?? getPinDirection(p2, chipMap[p2.chipId]!),
  }
  if (pin1._facingDirection !== pin2._facingDirection) return false

  const perpendicularOffset = pin1._facingDirection.startsWith("x")
    ? Math.abs(pin1.y - pin2.y)
    : Math.abs(pin1.x - pin2.x)
  if (perpendicularOffset > MAX_NEAR_ALIGNED_OFFSET + 1e-9) return false

  const { directShortPath, defaultElbow, adaptiveElbow } =
    getInitialTracePathCandidates({ pin1, pin2 })
  // Direct short paths are accepted immediately, and three-point elbows have
  // a supported endpoint-detour expansion in the single-line solver.
  if (directShortPath) return false

  return [defaultElbow, adaptiveElbow].every(
    (path) =>
      path.length !== 3 &&
      pathCrossesEndpointChip({ path, pins: [pin1, pin2], chipMap }),
  )
}
