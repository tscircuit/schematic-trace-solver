import type { Bounds, Point } from "@tscircuit/math-utils"
import type { InputProblem } from "lib/types/InputProblem"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isPathCollidingWithObstacles,
  segmentIntersectsRect,
} from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"
import { detectTraceLabelOverlap } from "./detectTraceLabelOverlap"
import { generateFourPointDetourCandidates } from "./tryFourPointDetour"
import { generateSnipAndReconnectCandidates } from "./trySnipAndReconnect"
import { findTraceViolationZone } from "./violation"

const OVERLAP_EPS = 1e-6
const TOUCH_MARGIN = 0.01

const boundsStrictlyOverlap = (a: Bounds, b: Bounds) =>
  a.minX < b.maxX - OVERLAP_EPS &&
  a.maxX > b.minX + OVERLAP_EPS &&
  a.minY < b.maxY - OVERLAP_EPS &&
  a.maxY > b.minY + OVERLAP_EPS

const boundsTouchOrOverlap = (a: Bounds, b: Bounds) =>
  a.minX <= b.maxX + TOUCH_MARGIN &&
  a.maxX >= b.minX - TOUCH_MARGIN &&
  a.minY <= b.maxY + TOUCH_MARGIN &&
  a.maxY >= b.minY - TOUCH_MARGIN

const isPointStrictlyInsideBounds = (p: Point, b: Bounds) =>
  p.x > b.minX + OVERLAP_EPS &&
  p.x < b.maxX - OVERLAP_EPS &&
  p.y > b.minY + OVERLAP_EPS &&
  p.y < b.maxY - OVERLAP_EPS

const generateExpandedObstacleDetourCandidates = ({
  initialTrace,
  label,
  labelBounds,
  problem,
  netLabelPlacements,
  tracesToAvoidOverlapping,
  standardCandidates,
}: {
  initialTrace: SolvedTracePath
  label: NetLabelPlacement
  labelBounds: Bounds
  problem: InputProblem
  netLabelPlacements?: NetLabelPlacement[]
  tracesToAvoidOverlapping?: SolvedTracePath[]
  standardCandidates: Point[][]
}): Point[][] => {
  if (label.mspConnectionPairIds.length > 0) return []

  const startPoint = initialTrace.tracePath[0]
  const endPoint = initialTrace.tracePath[initialTrace.tracePath.length - 1]
  if (!startPoint || !endPoint) return []

  const obstacles = getObstacleRects(problem)
  const chipObstacles = obstacles.filter((o) => o.kind === "chip")
  const traceChipIds = new Set(
    problem.chips
      .filter((c) =>
        c.pins.some(
          (p) =>
            initialTrace.pinIds.includes(p.pinId) ||
            initialTrace.pins.some((tp) => tp.pinId === p.pinId),
        ),
      )
      .map((c) => c.chipId),
  )

  const isPointNearChip = (p: Point, chip: Bounds) =>
    boundsTouchOrOverlap(chip, {
      minX: p.x,
      maxX: p.x,
      minY: p.y,
      maxY: p.y,
    })

  const initialSimplified = simplifyPath(initialTrace.tracePath)
  const allLabels = netLabelPlacements ?? [label]
  const isAnchoredAtOwnPin = (l: NetLabelPlacement) =>
    problem.chips.some((c) =>
      c.pins.some(
        (p) =>
          l.pinIds.includes(p.pinId) &&
          Math.abs(p.x - l.anchorPoint.x) < OVERLAP_EPS &&
          Math.abs(p.y - l.anchorPoint.y) < OVERLAP_EPS,
      ),
    )
  const portOnlyLabelsInGroup = allLabels.filter((l) => {
    if (l.mspConnectionPairIds.length > 0) return false
    if (l.globalConnNetId === initialTrace.globalConnNetId) return false
    if (!isAnchoredAtOwnPin(l)) return false
    const lb = getRectBounds(l.center, l.width, l.height)
    if (!boundsTouchOrOverlap(lb, labelBounds)) return false
    return (
      detectTraceLabelOverlap({
        traces: [{ ...initialTrace, tracePath: initialSimplified }],
        netLabels: [l],
      }).length > 0
    )
  })
  if (portOnlyLabelsInGroup.length < 2) return []

  const overlappingChips = chipObstacles.filter((chip) => {
    if (isPointNearChip(startPoint, chip)) {
      return false
    }
    const isEndPointOnChipTopEdge =
      Math.abs(endPoint.y - chip.maxY) < OVERLAP_EPS &&
      endPoint.x > chip.minX + OVERLAP_EPS &&
      endPoint.x < chip.maxX - OVERLAP_EPS &&
      endPoint.x < labelBounds.minX - OVERLAP_EPS
    if (
      (traceChipIds.has(chip.chipId) || isPointNearChip(endPoint, chip)) &&
      !isEndPointOnChipTopEdge
    ) {
      return false
    }
    const nonOwnedGroupLabels = portOnlyLabelsInGroup.filter((l) => {
      const ownsLabel = problem.chips
        .find((c) => c.chipId === chip.chipId)
        ?.pins.some((p) => l.pinIds.includes(p.pinId))
      return !ownsLabel
    })
    const someOverlapsChip = nonOwnedGroupLabels.some((l) =>
      boundsStrictlyOverlap(chip, getRectBounds(l.center, l.width, l.height)),
    )
    const someClearsChip = nonOwnedGroupLabels.some(
      (l) =>
        !boundsStrictlyOverlap(
          chip,
          getRectBounds(l.center, l.width, l.height),
        ),
    )
    return someOverlapsChip && someClearsChip
  })
  if (overlappingChips.length === 0) return []
  const otherTraces = (tracesToAvoidOverlapping ?? []).filter(
    (t) => t.globalConnNetId !== initialTrace.globalConnNetId,
  )
  const initialOverlapCount = detectTraceLabelOverlap({
    traces: [{ ...initialTrace, tracePath: initialSimplified }],
    netLabels: allLabels,
  }).length

  const isCandidateValid = (rawPath: Point[]) => {
    const simplified = simplifyPath(rawPath)
    const stillOverlapsTarget =
      detectTraceLabelOverlap({
        traces: [{ ...initialTrace, tracePath: simplified }],
        netLabels: [label],
      }).length > 0
    if (stillOverlapsTarget) return false
    const labelOverlaps = detectTraceLabelOverlap({
      traces: [{ ...initialTrace, tracePath: simplified }],
      netLabels: allLabels,
    }).length
    if (labelOverlaps > initialOverlapCount) return false
    if (isPathCollidingWithObstacles(simplified, obstacles)) return false
    if (doesPathCoincideWithTraces(simplified, otherTraces)) return false
    return true
  }

  if (standardCandidates.some(isCandidateValid)) {
    return []
  }

  let firstCollidingSeg = -1
  let lastCollidingSeg = -1
  for (let i = 0; i < initialTrace.tracePath.length - 1; i++) {
    if (
      segmentIntersectsRect(
        initialTrace.tracePath[i]!,
        initialTrace.tracePath[i + 1]!,
        { ...labelBounds, chipId: "temp-obstacle" },
      )
    ) {
      if (firstCollidingSeg === -1) firstCollidingSeg = i
      lastCollidingSeg = i
    }
  }
  if (firstCollidingSeg === -1) return []

  const entryIndex = firstCollidingSeg
  const exitIndex = lastCollidingSeg + 1
  const entryPoint = initialTrace.tracePath[entryIndex]
  const exitPoint = initialTrace.tracePath[exitIndex]
  if (!entryPoint || !exitPoint || entryIndex >= exitIndex) return []

  const mergedBounds: Bounds = {
    minX: labelBounds.minX,
    maxX: labelBounds.maxX,
    minY: labelBounds.minY,
    maxY: labelBounds.maxY,
  }

  for (const chip of overlappingChips) {
    if (
      isPointStrictlyInsideBounds(entryPoint, chip) ||
      isPointStrictlyInsideBounds(exitPoint, chip)
    ) {
      continue
    }
    mergedBounds.minX = Math.min(mergedBounds.minX, chip.minX)
    mergedBounds.maxX = Math.max(mergedBounds.maxX, chip.maxX)
    mergedBounds.minY = Math.min(mergedBounds.minY, chip.minY)
    mergedBounds.maxY = Math.max(mergedBounds.maxY, chip.maxY)
  }

  const otherLabels = (netLabelPlacements ?? []).filter(
    (l) => l.globalConnNetId !== initialTrace.globalConnNetId,
  )
  let changed = true
  const mergedLabels = new Set<NetLabelPlacement>()
  while (changed) {
    changed = false
    for (const other of otherLabels) {
      if (mergedLabels.has(other)) continue
      const ob = getRectBounds(other.center, other.width, other.height)
      if (boundsTouchOrOverlap(mergedBounds, ob)) {
        mergedLabels.add(other)
        mergedBounds.minX = Math.min(mergedBounds.minX, ob.minX)
        mergedBounds.maxX = Math.max(mergedBounds.maxX, ob.maxX)
        mergedBounds.minY = Math.min(mergedBounds.minY, ob.minY)
        mergedBounds.maxY = Math.max(mergedBounds.maxY, ob.maxY)
        changed = true
      }
    }
  }

  const isPrevHorizontal =
    entryIndex > 0 &&
    Math.abs(initialTrace.tracePath[entryIndex - 1]!.y - entryPoint.y) <
      OVERLAP_EPS
  const entryXCandidates = isPrevHorizontal
    ? [entryPoint.x, entryPoint.x + 0.02, entryPoint.x - 0.02]
    : [entryPoint.x]

  const xOffsets = [0.1, 0.15, 0.22]
  const yOffsets = [0.1, 0.15, 0.18, 0.22]
  const detours: Point[][] = []
  for (const yOffset of yOffsets) {
    const bottomY = mergedBounds.minY - yOffset
    const topY = mergedBounds.maxY + yOffset

    for (const entryX of entryXCandidates) {
      for (const xOffset of xOffsets) {
        const leftX = mergedBounds.minX - xOffset
        const rightX = mergedBounds.maxX + xOffset

        detours.push(
          [
            { x: entryX, y: entryPoint.y },
            { x: entryX, y: bottomY },
            { x: leftX, y: bottomY },
            { x: leftX, y: exitPoint.y },
          ],
          [
            { x: entryX, y: entryPoint.y },
            { x: entryX, y: bottomY },
            { x: rightX, y: bottomY },
            { x: rightX, y: exitPoint.y },
          ],
          [
            { x: entryX, y: entryPoint.y },
            { x: entryX, y: bottomY },
            { x: leftX, y: bottomY },
            { x: leftX, y: topY },
            { x: exitPoint.x, y: topY },
          ],
          [
            { x: entryX, y: entryPoint.y },
            { x: entryX, y: topY },
            { x: leftX, y: topY },
            { x: leftX, y: bottomY },
            { x: exitPoint.x, y: bottomY },
          ],
          [
            { x: entryX, y: entryPoint.y },
            { x: entryX, y: bottomY },
            { x: rightX, y: bottomY },
            { x: rightX, y: topY },
            { x: exitPoint.x, y: topY },
          ],
        )
      }
    }
  }

  const prefix = initialTrace.tracePath.slice(0, entryIndex)
  const suffix = initialTrace.tracePath.slice(exitIndex + 1)
  return detours
    .map((detourPoints) => [...prefix, ...detourPoints, exitPoint, ...suffix])
    .filter(isCandidateValid)
}

/**
 * Generates a list of candidate rerouted paths for a given trace that is
 * colliding with a net label.
 *
 * This function employs multiple strategies to propose alternative paths:
 * 1.  **Four-Point Detour:** Creates a rectangular detour around the label.
 * 2.  **Snip and Reconnect:** Attempts to remove the colliding segment and
 *     reconnect the trace around the obstacle.
 *
 * The candidates are generated with increasing padding based on `detourCount`
 * to explore progressively wider detours.
 */
export const generateRerouteCandidates = ({
  trace,
  label,
  problem,
  paddingBuffer,
  detourCount,
  netLabelPlacements,
  tracesToAvoidOverlapping,
}: {
  trace: SolvedTracePath
  label: NetLabelPlacement
  problem: InputProblem
  paddingBuffer: number
  detourCount: number
  netLabelPlacements?: NetLabelPlacement[]
  tracesToAvoidOverlapping?: SolvedTracePath[]
}): Point[][] => {
  const initialTrace = { ...trace, tracePath: simplifyPath(trace.tracePath) }

  if (trace.globalConnNetId === label.globalConnNetId) {
    return [initialTrace.tracePath]
  }

  const labelBoundsRaw = getRectBounds(label.center, label.width, label.height)
  const labelBounds = {
    minX: labelBoundsRaw.minX,
    minY: labelBoundsRaw.minY,
    maxX: labelBoundsRaw.maxX,
    maxY: labelBoundsRaw.maxY,
    chipId: `netlabel-${label.netId}`,
  }

  const fourPointCandidates = generateFourPointDetourCandidates({
    initialTrace,
    label,
    labelBounds,
    paddingBuffer,
    detourCount,
  })

  const effectivePadding = paddingBuffer + detourCount * paddingBuffer
  const paddedLabelBounds = {
    minX: labelBounds.minX - effectivePadding,
    maxX: labelBounds.maxX + effectivePadding,
    minY: labelBounds.minY - effectivePadding,
    maxY: labelBounds.maxY + effectivePadding,
  }

  const { firstInsideIndex, lastInsideIndex } = findTraceViolationZone({
    path: initialTrace.tracePath,
    labelBounds,
    paddedBounds: paddedLabelBounds,
  })

  const snipReconnectCandidates = generateSnipAndReconnectCandidates({
    initialTrace,
    firstInsideIndex,
    lastInsideIndex,
    labelBounds,
    paddingBuffer,
    detourCount,
  })

  const standardCandidates = [
    ...fourPointCandidates,
    ...snipReconnectCandidates,
  ]

  const expandedObstacleCandidates = generateExpandedObstacleDetourCandidates({
    initialTrace,
    label,
    labelBounds,
    problem,
    netLabelPlacements,
    tracesToAvoidOverlapping,
    standardCandidates,
  })

  if (expandedObstacleCandidates.length > 0) {
    return expandedObstacleCandidates
  }

  return standardCandidates
}
