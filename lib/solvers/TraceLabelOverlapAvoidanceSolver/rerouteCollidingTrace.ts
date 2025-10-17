import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { getObstacleRects } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import {
  isPathCollidingWithObstacles,
  segmentIntersectsRect,
} from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { InputProblem } from "lib/types/InputProblem"
import { findTraceViolationZone } from "./violation"
import { tryFourPointDetour, trySnipAndReconnect } from "./trySnipAndReconnect"
import { simplifyPath } from "./simplifyPath"
import { generateElbowVariants } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/generateElbowVariants"
import type { Guideline } from "lib/solvers/GuidelinesSolver/GuidelinesSolver"

export const rerouteCollidingTrace = ({
  trace,
  label,
  problem,
  paddingBuffer,
  detourCount,
}: {
  trace: SolvedTracePath
  label: NetLabelPlacement
  problem: InputProblem
  paddingBuffer: number
  detourCount: number
}): SolvedTracePath => {
  const initialTrace = { ...trace, tracePath: simplifyPath(trace.tracePath) }

  if (trace.globalConnNetId === label.globalConnNetId) {
    return initialTrace
  }

  const obstacles = getObstacleRects(problem)
  const labelPadding = paddingBuffer
  const labelBoundsRaw = getRectBounds(label.center, label.width, label.height)
  const labelBounds = {
    minX: labelBoundsRaw.minX - labelPadding,
    minY: labelBoundsRaw.minY - labelPadding,
    maxX: labelBoundsRaw.maxX + labelPadding,
    maxY: labelBoundsRaw.maxY + labelPadding,
    chipId: `netlabel-${label.netId}`,
  }

  const fourPointResult = tryFourPointDetour({
    initialTrace,
    label,
    labelBounds,
    obstacles,
    paddingBuffer,
    detourCount,
  })
  if (fourPointResult) {
    initialTrace.tracePath = fourPointResult.tracePath
  }
  const { firstInsideIndex, lastInsideIndex } = findTraceViolationZone(
    initialTrace.tracePath,
    labelBounds,
  )

  const snipReconnectResult = trySnipAndReconnect({
    initialTrace,
    firstInsideIndex,
    lastInsideIndex,
    labelBounds,
    obstacles,
  })

  if (snipReconnectResult) {
    return snipReconnectResult
  }

  // Fallback: slide interior segments using guideline-driven elbow variants
  // around the label to find a minimal, orthogonal adjustment that avoids overlap.
  {
    const EPS = 1e-3
    const guidelines: Guideline[] = [
      // Push past padded bounds slightly to guarantee non-intersection
      { orientation: "vertical", x: labelBounds.minX - EPS, y: undefined },
      { orientation: "vertical", x: labelBounds.maxX + EPS, y: undefined },
      { orientation: "horizontal", y: labelBounds.minY - EPS, x: undefined },
      { orientation: "horizontal", y: labelBounds.maxY + EPS, x: undefined },
    ]

    const { elbowVariants } = generateElbowVariants({
      baseElbow: initialTrace.tracePath,
      guidelines,
      maxVariants: 200,
    })

    // Evaluate candidates: must avoid the padded label bounds and obstacles
    for (const candidate of elbowVariants) {
      // Skip the original path (already known to overlap)
      if (candidate === initialTrace.tracePath) continue

      let intersectsLabel = false
      for (let i = 0; i < candidate.length - 1; i++) {
        if (
          segmentIntersectsRect(candidate[i]!, candidate[i + 1]!, labelBounds)
        ) {
          intersectsLabel = true
          break
        }
      }
      if (intersectsLabel) continue

      const simplified = simplifyPath(candidate)
      if (!isPathCollidingWithObstacles(simplified, obstacles)) {
        return { ...initialTrace, tracePath: simplified }
      }
    }
  }

  if (fourPointResult) {
    return fourPointResult
  }

  return initialTrace
}
