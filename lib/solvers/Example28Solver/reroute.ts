import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { segmentIntersectsRect as segmentIntersectsLabelRect } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"
import { detectTraceLabelOverlap } from "../TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import { generateRerouteCandidates } from "../TraceLabelOverlapAvoidanceSolver/rerouteCollidingTrace"
import type { InputProblem } from "../../types/InputProblem"
import { dir } from "../../utils/dir"
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

const LABEL_SIDE_CLEARANCE = 0.1
const LABEL_HUG_CLEARANCE = 0.001

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
    trace,
    label,
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
      paddingBuffer: LABEL_SIDE_CLEARANCE,
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

  return {
    path,
    score: scoreTracePath({
      trace,
      tracePath: path,
      obstacleLabel,
      outputTraces,
      outputNetLabelPlacements,
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

  const bounds = getRectBounds(label.center, label.width, label.height)
  const padding = LABEL_SIDE_CLEARANCE
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
        { x: start.x, y: topY },
        { x: sideX, y: topY },
        { x: sideX, y: bottomY },
        { x: end.x, y: bottomY },
        end,
      ],
      [
        start,
        { x: start.x, y: bottomY },
        { x: sideX, y: bottomY },
        { x: sideX, y: topY },
        { x: end.x, y: topY },
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

  const labelDirection = dir(label.orientation)
  if (labelDirection.x === 0) return []

  const bounds = getRectBounds(label.center, label.width, label.height)
  const sideX =
    labelDirection.x < 0
      ? bounds.minX - LABEL_SIDE_CLEARANCE
      : bounds.maxX + LABEL_SIDE_CLEARANCE
  const topY = bounds.maxY + LABEL_HUG_CLEARANCE
  const bottomY = bounds.minY - LABEL_HUG_CLEARANCE
  const startsAboveEnd = start.y >= end.y
  const firstY = startsAboveEnd ? topY : bottomY
  const secondY = startsAboveEnd ? bottomY : topY

  return [
    [
      start,
      { x: start.x, y: firstY },
      { x: sideX, y: firstY },
      { x: sideX, y: secondY },
      { x: end.x, y: secondY },
      end,
    ],
    [
      start,
      { x: start.x, y: secondY },
      { x: sideX, y: secondY },
      { x: sideX, y: firstY },
      { x: end.x, y: firstY },
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
}: {
  trace: SolvedTracePath
  obstacleLabel: NetLabelPlacement
  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  candidateResults: RerouteCandidateResult[]
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
  })

  for (const candidate of candidateResults) {
    if (candidate.status !== "valid" || !candidate.score) continue
    if (!isBetterScore(candidate.score, bestScore)) continue

    bestScore = candidate.score
    bestPath = candidate.path
  }

  return bestPath
}

const generateHorizontalSegmentPushCandidate = (
  trace: SolvedTracePath,
  label: NetLabelPlacement,
): Point[] | null => {
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

  let segmentPushX = bounds.minX - LABEL_SIDE_CLEARANCE
  if (labelDirection.x > 0) {
    segmentPushX = bounds.maxX + LABEL_SIDE_CLEARANCE
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
    return labelBounds.maxY + LABEL_HUG_CLEARANCE
  }

  return labelBounds.minY - LABEL_HUG_CLEARANCE
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
}: {
  trace: SolvedTracePath
  tracePath: Point[]
  obstacleLabel: NetLabelPlacement
  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
}): TracePathScore => {
  const candidateTrace = { ...trace, tracePath }
  return {
    labelIntersections: detectTraceLabelOverlap({
      traces: [candidateTrace],
      netLabels: outputNetLabelPlacements,
    }).length,
    labelHugDistance: getLabelHugDistance(tracePath, obstacleLabel),
    traceIntersections: countTraceIntersections(candidateTrace, outputTraces),
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
