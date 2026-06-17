import type {
  InputChip,
  InputPin,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import { getRestrictedCenterLines } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getRestrictedCenterLines"

export const doesPairCrossRestrictedCenterLines = (params: {
  inputProblem: InputProblem
  chipMap: Record<string, InputChip>
  pinIdMap: Map<PinId, InputPin & { chipId: string }>
  p1: InputPin & { chipId: string }
  p2: InputPin & { chipId: string }
}): boolean => {
  const { inputProblem, chipMap, pinIdMap, p1, p2 } = params

  const restrictedCenterLines = getRestrictedCenterLines({
    pins: [p1, p2],
    inputProblem,
    pinIdMap,
    chipMap,
  })

  if (restrictedCenterLines.size === 0) return false

  const EPS = 1e-9

  const crossesSegment = (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ): boolean => {
    for (const [, rcl] of restrictedCenterLines) {
      if (rcl.axes.has("x") && typeof rcl.x === "number") {
        if ((a.x - rcl.x) * (b.x - rcl.x) < -EPS) return true
      }
      if (rcl.axes.has("y") && typeof rcl.y === "number") {
        if ((a.y - rcl.y) * (b.y - rcl.y) < -EPS) return true
      }
    }
    return false
  }

  // If already aligned on one axis, just check that single segment
  if (Math.abs(p1.x - p2.x) < EPS || Math.abs(p1.y - p2.y) < EPS) {
    return crossesSegment({ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y })
  }

  // Two L-shape possibilities: horizontal-then-vertical or vertical-then-horizontal
  const elbowHV = { x: p2.x, y: p1.y }
  const elbowVH = { x: p1.x, y: p2.y }

  const hvCrosses =
    crossesSegment({ x: p1.x, y: p1.y }, elbowHV) ||
    crossesSegment(elbowHV, { x: p2.x, y: p2.y })
  const vhCrosses =
    crossesSegment({ x: p1.x, y: p1.y }, elbowVH) ||
    crossesSegment(elbowVH, { x: p2.x, y: p2.y })

  // Forbid the pair only if both L-shape routes would cross a restricted center line
  return hvCrosses && vhCrosses
}
