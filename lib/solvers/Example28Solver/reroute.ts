import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { segmentIntersectsRect as segmentIntersectsLabelRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import { generateRerouteCandidates } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/rerouteCollidingTrace"
import type { InputProblem } from "lib/types/InputProblem"
import { dir } from "lib/utils/dir"
import { getChipBoundaryOverlap } from "./doesPathRunAlongChipBoundary"
import {
  countPathIntersections,
  getPathKey,
  getPathLength,
  isPathCollidingWithChipInterior,
} from "./geometry"
import type {
  ChipObstacle,
  RerouteCandidateResult,
  TracePathScore,
} from "./types"

const LABEL_CLEARANCE = 0.1
// How many LABEL_CLEARANCE-wide corridors to try before giving up on finding a
// free one for a pushed segment.
const MAX_CORRIDOR_SHIFTS = 16

/**
 * Whether a vertical trace segment of a different net already runs along the
 * corridor at `x`, overlapping the [lowY, highY] span (within a corridor width).
 */
const corridorHasOtherNetTrace = ({
  x,
  lowY,
  highY,
  outputTraces,
  netId,
}: {
  x: number
  lowY: number
  highY: number
  outputTraces: SolvedTracePath[]
  netId: string
}): boolean => {
  for (const other of outputTraces) {
    if (other.globalConnNetId === netId) continue
    const path = other.tracePath
    for (let i = 0; i + 1 < path.length; i++) {
      const start = path[i]!
      const end = path[i + 1]!
      if (Math.abs(start.x - end.x) >= 1e-9) continue
      if (Math.abs(start.x - x) >= LABEL_CLEARANCE / 2) continue
      const segLowY = Math.min(start.y, end.y)
      const segHighY = Math.max(start.y, end.y)
      if (Math.min(highY, segHighY) - Math.max(lowY, segLowY) > 1e-6)
        return true
    }
  }
  return false
}

export const findBestReroutePath = ({
  trace,
  obstacleLabel,
  inputProblem,
  outputTraces,
  outputNetLabelPlacements,
  chipObstacles,
}: {
  trace: SolvedTracePath
  obstacleLabel: NetLabelPlacement
  inputProblem: InputProblem
  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  chipObstacles: ChipObstacle[]
}) => {
  const candidateResults = generateRerouteCandidateResults({
    trace,
    label: obstacleLabel,
    inputProblem,
    outputTraces,
    outputNetLabelPlacements,
    chipObstacles,
  })
  const bestPath = selectBestReroutePath({
    trace,
    obstacleLabel,
    outputTraces,
    outputNetLabelPlacements,
    candidateResults,
    chipObstacles,
  })

  markSelectedCandidate(candidateResults, bestPath)

  return { bestPath, candidateResults }
}

export const generateRerouteCandidateResults = ({
  trace,
  label,
  inputProblem,
  outputTraces,
  outputNetLabelPlacements,
  chipObstacles,
}: {
  trace: SolvedTracePath
  label: NetLabelPlacement
  inputProblem: InputProblem
  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  chipObstacles: ChipObstacle[]
}) => {
  const seen = new Set<string>()
  const candidateResults: RerouteCandidateResult[] = []
  const horizontalSegmentPushCandidate = generateHorizontalSegmentPushCandidate(
    {
      trace,
      label,
      outputTraces,
    },
  )

  if (horizontalSegmentPushCandidate) {
    candidateResults.push(
      createCandidateResult({
        trace,
        obstacleLabel: label,
        path: horizontalSegmentPushCandidate,
        seen,
        outputTraces,
        outputNetLabelPlacements,
        chipObstacles,
        usesHorizontalSegmentPush: true,
      }),
    )
  }

  const rawCandidates = [
    ...generateLabelHugCandidates(trace, label),
    ...generateRerouteCandidates({
      trace,
      label,
      problem: inputProblem,
      paddingBuffer: LABEL_CLEARANCE,
      detourCount: 0,
    }),
    ...generateEndpointDetourCandidates(trace, label),
  ]

  for (const rawCandidate of rawCandidates) {
    candidateResults.push(
      createCandidateResult({
        trace,
        obstacleLabel: label,
        path: simplifyPath(rawCandidate),
        seen,
        outputTraces,
        outputNetLabelPlacements,
        chipObstacles,
      }),
    )
  }

  return candidateResults
}

const createCandidateResult = ({
  trace,
  obstacleLabel,
  path,
  seen,
  outputTraces,
  outputNetLabelPlacements,
  chipObstacles,
  usesHorizontalSegmentPush,
}: {
  trace: SolvedTracePath
  obstacleLabel: NetLabelPlacement
  path: Point[]
  seen: Set<string>
  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  chipObstacles: ChipObstacle[]
  usesHorizontalSegmentPush?: boolean
}): RerouteCandidateResult => {
  const key = getPathKey(path)

  if (seen.has(key)) {
    return {
      path,
      status: "duplicate",
      usesHorizontalSegmentPush,
      selected: false,
    }
  }

  seen.add(key)

  if (isPathCollidingWithChipInterior(path, chipObstacles)) {
    return {
      path,
      status: "chip-collision",
      usesHorizontalSegmentPush,
      selected: false,
    }
  }

  // Note: a path that merely runs along a chip boundary is NOT rejected here.
  // It is a valid route, just a lower-quality one — scoreTracePath penalizes it
  // via chipBoundaryOverlap so it loses only to routes that are otherwise as
  // good. Hard-rejecting it discarded the best available route when every
  // alternative overlapped a label or another trace.
  return {
    path,
    score: scoreTracePath({
      trace,
      tracePath: path,
      obstacleLabel,
      outputTraces,
      outputNetLabelPlacements,
      chipObstacles,
    }),
    status: "valid",
    usesHorizontalSegmentPush,
    selected: false,
  }
}

const generateEndpointDetourCandidates = (
  trace: SolvedTracePath,
  label: NetLabelPlacement,
): Point[][] => {
  const start = trace.tracePath[0]
  const end = trace.tracePath[trace.tracePath.length - 1]
  if (!start || !end) return []
  const startExit = trace.tracePath[1] ?? start
  const endEntry = trace.tracePath[trace.tracePath.length - 2] ?? end

  const bounds = getRectBounds(label.center, label.width, label.height)
  const padding = LABEL_CLEARANCE
  const labelDirection = dir(label.orientation)
  const labelSideX =
    labelDirection.x < 0 ? bounds.minX - padding : bounds.maxX + padding
  const oppositeSideX =
    labelDirection.x < 0 ? bounds.maxX + padding : bounds.minX - padding
  const topY = bounds.maxY + padding
  const bottomY = bounds.minY - padding
  const candidates: Point[][] = []

  for (const sideX of [labelSideX, oppositeSideX]) {
    candidates.push(
      [
        start,
        startExit,
        { x: startExit.x, y: topY },
        { x: sideX, y: topY },
        { x: sideX, y: bottomY },
        { x: endEntry.x, y: bottomY },
        endEntry,
        end,
      ],
      [
        start,
        startExit,
        { x: startExit.x, y: bottomY },
        { x: sideX, y: bottomY },
        { x: sideX, y: topY },
        { x: endEntry.x, y: topY },
        endEntry,
        end,
      ],
    )
  }

  return candidates
}

const generateLabelHugCandidates = (
  trace: SolvedTracePath,
  label: NetLabelPlacement,
): Point[][] => {
  const start = trace.tracePath[0]
  const end = trace.tracePath[trace.tracePath.length - 1]
  if (!start || !end) return []
  const startExit = trace.tracePath[1] ?? start
  const endEntry = trace.tracePath[trace.tracePath.length - 2] ?? end

  const labelDirection = dir(label.orientation)
  if (labelDirection.x === 0) return []

  const bounds = getRectBounds(label.center, label.width, label.height)
  const sideX =
    labelDirection.x < 0
      ? bounds.minX - LABEL_CLEARANCE
      : bounds.maxX + LABEL_CLEARANCE
  const topY = bounds.maxY + LABEL_CLEARANCE
  const bottomY = bounds.minY - LABEL_CLEARANCE
  const startsAboveEnd = startExit.y >= endEntry.y
  const firstY = startsAboveEnd ? topY : bottomY
  const secondY = startsAboveEnd ? bottomY : topY

  return [
    [
      start,
      startExit,
      { x: startExit.x, y: firstY },
      { x: sideX, y: firstY },
      { x: sideX, y: secondY },
      { x: endEntry.x, y: secondY },
      endEntry,
      end,
    ],
    [
      start,
      startExit,
      { x: startExit.x, y: secondY },
      { x: sideX, y: secondY },
      { x: sideX, y: firstY },
      { x: endEntry.x, y: firstY },
      endEntry,
      end,
    ],
  ]
}

const selectBestReroutePath = ({
  trace,
  obstacleLabel,
  outputTraces,
  outputNetLabelPlacements,
  candidateResults,
  chipObstacles,
}: {
  trace: SolvedTracePath
  obstacleLabel: NetLabelPlacement
  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  candidateResults: RerouteCandidateResult[]
  chipObstacles: ChipObstacle[]
}) => {
  for (const candidate of candidateResults) {
    if (!candidate.usesHorizontalSegmentPush) continue
    if (candidate.status !== "valid") continue
    if (!candidate.score) continue
    return candidate.path
  }

  let bestPath: Point[] | null = null
  let bestScore = scoreTracePath({
    trace,
    tracePath: trace.tracePath,
    obstacleLabel,
    outputTraces,
    outputNetLabelPlacements,
    chipObstacles,
  })

  for (const candidate of candidateResults) {
    if (candidate.status !== "valid" || !candidate.score) continue
    if (!isBetterScore(candidate.score, bestScore)) continue

    bestScore = candidate.score
    bestPath = candidate.path
  }

  return bestPath
}

const generateHorizontalSegmentPushCandidate = ({
  trace,
  label,
  outputTraces,
}: {
  trace: SolvedTracePath
  label: NetLabelPlacement
  outputTraces: SolvedTracePath[]
}): Point[] | null => {
  const labelDirection = dir(label.orientation)
  if (labelDirection.x === 0) return null

  const path = trace.tracePath
  const bounds = getRectBounds(label.center, label.width, label.height)
  const collidingVerticalSegmentIndex = path.findIndex((start, index) => {
    const end = path[index + 1]
    if (!end) return false
    if (Math.abs(start.x - end.x) >= 1e-9) return false
    return segmentIntersectsLabelRect(start, end, bounds)
  })

  if (
    collidingVerticalSegmentIndex <= 0 ||
    collidingVerticalSegmentIndex >= path.length - 2
  ) {
    return null
  }

  const previousAnchor = path[collidingVerticalSegmentIndex - 1]!
  const verticalStart = path[collidingVerticalSegmentIndex]!
  const verticalEnd = path[collidingVerticalSegmentIndex + 1]!
  const nextAnchor = path[collidingVerticalSegmentIndex + 2]!

  if (
    Math.abs(previousAnchor.y - verticalStart.y) >= 1e-9 ||
    Math.abs(verticalEnd.y - nextAnchor.y) >= 1e-9
  ) {
    return null
  }

  let segmentPushX = bounds.minX - LABEL_CLEARANCE
  if (labelDirection.x > 0) {
    segmentPushX = bounds.maxX + LABEL_CLEARANCE
  }

  // Two traces escaping the same label block would otherwise be pushed to the
  // identical corridor and stack on one line. Slide the corridor further out
  // until it no longer coincides with a different-net trace already routed
  // there, giving each escaping trace its own parallel corridor.
  const corridorStep = labelDirection.x > 0 ? LABEL_CLEARANCE : -LABEL_CLEARANCE
  const verticalLowY = Math.min(verticalStart.y, verticalEnd.y)
  const verticalHighY = Math.max(verticalStart.y, verticalEnd.y)
  for (let shift = 0; shift < MAX_CORRIDOR_SHIFTS; shift++) {
    const occupied = corridorHasOtherNetTrace({
      x: segmentPushX,
      lowY: verticalLowY,
      highY: verticalHighY,
      outputTraces,
      netId: trace.globalConnNetId,
    })
    if (!occupied) break
    segmentPushX += corridorStep
  }
  const segmentPushStartY = getClearedHorizontalY({
    start: previousAnchor,
    end: { x: segmentPushX, y: verticalStart.y },
    labelBounds: bounds,
  })
  const segmentPushEndY = getClearedHorizontalY({
    start: { x: segmentPushX, y: verticalEnd.y },
    end: nextAnchor,
    labelBounds: bounds,
  })

  const segmentPushPath: Point[] = [
    ...path.slice(0, collidingVerticalSegmentIndex - 1),
    previousAnchor,
  ]

  if (Math.abs(previousAnchor.y - segmentPushStartY) >= 1e-9) {
    segmentPushPath.push({ x: previousAnchor.x, y: segmentPushStartY })
  }

  segmentPushPath.push({ x: segmentPushX, y: segmentPushStartY })
  segmentPushPath.push({ x: segmentPushX, y: segmentPushEndY })

  if (Math.abs(nextAnchor.y - segmentPushEndY) >= 1e-9) {
    segmentPushPath.push({ x: nextAnchor.x, y: segmentPushEndY })
  }

  segmentPushPath.push(
    nextAnchor,
    ...path.slice(collidingVerticalSegmentIndex + 3),
  )

  return simplifyPath(segmentPushPath)
}

const getClearedHorizontalY = ({
  start,
  end,
  labelBounds,
}: {
  start: Point
  end: Point
  labelBounds: { minX: number; minY: number; maxX: number; maxY: number }
}) => {
  if (!segmentIntersectsLabelRect(start, end, labelBounds)) return start.y

  const labelCenterY = (labelBounds.minY + labelBounds.maxY) / 2
  if (start.y >= labelCenterY) {
    return labelBounds.maxY + LABEL_CLEARANCE
  }

  return labelBounds.minY - LABEL_CLEARANCE
}

const markSelectedCandidate = (
  candidateResults: RerouteCandidateResult[],
  bestPath: Point[] | null,
) => {
  if (!bestPath) return

  for (const candidate of candidateResults) {
    candidate.selected = candidate.path === bestPath
  }
}

const scoreTracePath = ({
  trace,
  tracePath,
  obstacleLabel,
  outputTraces,
  outputNetLabelPlacements,
  chipObstacles,
}: {
  trace: SolvedTracePath
  tracePath: Point[]
  obstacleLabel: NetLabelPlacement
  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  chipObstacles: ChipObstacle[]
}): TracePathScore => {
  const candidateTrace = { ...trace, tracePath }
  return {
    labelIntersections: detectTraceLabelOverlap({
      traces: [candidateTrace],
      netLabels: outputNetLabelPlacements,
    }).length,
    labelHugDistance: getLabelHugDistance(tracePath, obstacleLabel),
    traceIntersections: countTraceIntersections(candidateTrace, outputTraces),
    chipBoundaryOverlap: getChipBoundaryOverlap(tracePath, chipObstacles),
    pathLength: getPathLength(tracePath),
  }
}

const countTraceIntersections = (
  trace: SolvedTracePath,
  outputTraces: SolvedTracePath[],
) => {
  let count = 0
  for (const otherTrace of outputTraces) {
    if (otherTrace.mspPairId === trace.mspPairId) continue
    count += countPathIntersections(trace.tracePath, otherTrace.tracePath)
  }
  return count
}

const isBetterScore = (score: TracePathScore, bestScore: TracePathScore) => {
  // A route with no label overlap is always preferred over one with any. This
  // is separate from the full overlap count below so that a *clean* route wins
  // even if it hugs a chip boundary, while a route that must overlap a label is
  // still steered away from also hugging a boundary.
  const scoreHasLabelOverlap = score.labelIntersections > 0
  const bestHasLabelOverlap = bestScore.labelIntersections > 0
  if (scoreHasLabelOverlap !== bestHasLabelOverlap) {
    // Reached only when exactly one route overlaps a label; the clean one wins.
    return !scoreHasLabelOverlap
  }
  // Boundary hugging is only accepted as the price of a clean route; once a
  // label overlap is unavoidable, avoid hugging a boundary on top of it.
  if (score.chipBoundaryOverlap !== bestScore.chipBoundaryOverlap) {
    return score.chipBoundaryOverlap < bestScore.chipBoundaryOverlap
  }
  if (score.labelIntersections !== bestScore.labelIntersections) {
    return score.labelIntersections < bestScore.labelIntersections
  }
  if (score.labelHugDistance !== bestScore.labelHugDistance) {
    return score.labelHugDistance < bestScore.labelHugDistance
  }
  if (score.traceIntersections !== bestScore.traceIntersections) {
    return score.traceIntersections < bestScore.traceIntersections
  }
  return score.pathLength < bestScore.pathLength
}

const getLabelHugDistance = (
  tracePath: Point[],
  obstacleLabel: NetLabelPlacement,
) => {
  const bounds = getRectBounds(
    obstacleLabel.center,
    obstacleLabel.width,
    obstacleLabel.height,
  )
  let distance = 0

  for (const point of tracePath) {
    distance += getPointDistanceFromRect(point, bounds)
  }

  return distance
}

const getPointDistanceFromRect = (
  point: Point,
  rect: { minX: number; minY: number; maxX: number; maxY: number },
) => {
  const dx = Math.max(rect.minX - point.x, 0, point.x - rect.maxX)
  const dy = Math.max(rect.minY - point.y, 0, point.y - rect.maxY)
  return dx + dy
}
