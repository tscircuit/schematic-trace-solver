import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import { findTraceViolationZone } from "./violation"
import { generateSnipAndReconnectCandidates } from "./trySnipAndReconnect"
import { generateFourPointDetourCandidates } from "./tryFourPointDetour"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"

import { generateMoveTraceSegmentsCandidates } from "./tryMoveTraceSegments"

const getPathLength = (pts: Point[]) => {
  let len = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x
    const dy = pts[i + 1].y - pts[i].y
    len += Math.sqrt(dx * dx + dy * dy)
  }
  return len
}

export const generateRerouteCandidates = ({
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
}): Point[][] => {
  const initialTrace = { ...trace, tracePath: simplifyPath(trace.tracePath) }

  if (trace.globalConnNetId === label.globalConnNetId) {
    return [initialTrace.tracePath]
  }

  const labelPadding = paddingBuffer
  const labelBoundsRaw = getRectBounds(label.center, label.width, label.height)
  const labelBounds = {
    minX: labelBoundsRaw.minX - labelPadding,
    minY: labelBoundsRaw.minY - labelPadding,
    maxX: labelBoundsRaw.maxX + labelPadding,
    maxY: labelBoundsRaw.maxY + labelPadding,
    chipId: `netlabel-${label.netId}`,
  }

  const fourPointCandidates = generateFourPointDetourCandidates({
    initialTrace,
    label,
    labelBounds,
    paddingBuffer,
    detourCount,
  })

  const { firstInsideIndex, lastInsideIndex } = findTraceViolationZone(
    initialTrace.tracePath,
    labelBounds,
  )

  const snipReconnectCandidates = generateSnipAndReconnectCandidates({
    initialTrace,
    firstInsideIndex,
    lastInsideIndex,
    labelBounds,
    paddingBuffer,
    detourCount,
  })

  const moveTraceSegmentsCandidates = generateMoveTraceSegmentsCandidates({
    initialTrace,
    label,
    labelBounds,
    paddingBuffer,
    detourCount,
  })

  // Return candidates in order of preference: four-point, snip-reconnect, then move trace segments
  const allCandidates = [
    ...fourPointCandidates,
    ...snipReconnectCandidates,
    ...moveTraceSegmentsCandidates,
  ]

  // Sort by path length within each group, but keep move trace segments at the end
  const sortedFourPoint = fourPointCandidates.sort(
    (a, b) => getPathLength(a) - getPathLength(b),
  )
  const sortedSnipReconnect = snipReconnectCandidates.sort(
    (a, b) => getPathLength(a) - getPathLength(b),
  )
  const sortedMoveTrace = moveTraceSegmentsCandidates.sort(
    (a, b) => getPathLength(a) - getPathLength(b),
  )

  return [...sortedFourPoint, ...sortedSnipReconnect, ...sortedMoveTrace]
}
