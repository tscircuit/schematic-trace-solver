import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import { generateRerouteCandidates } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/rerouteCollidingTrace"
import type { InputProblem } from "lib/types/InputProblem"
import { dir } from "lib/utils/dir"
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
  const rawCandidates = generateCandidatePaths(trace, label, inputProblem)
  const seen = new Set<string>()
  const candidateResults: RerouteCandidateResult[] = []

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

const generateCandidatePaths = (
  trace: SolvedTracePath,
  label: NetLabelPlacement,
  inputProblem: InputProblem,
) => [
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

const createCandidateResult = ({
  trace,
  obstacleLabel,
  path,
  seen,
  outputTraces,
  outputNetLabelPlacements,
  chipObstacles,
}: {
  trace: SolvedTracePath
  obstacleLabel: NetLabelPlacement
  path: Point[]
  seen: Set<string>
  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  chipObstacles: ChipObstacle[]
}): RerouteCandidateResult => {
  const key = getPathKey(path)

  if (seen.has(key)) {
    return {
      path,
      status: "duplicate",
      selected: false,
    }
  }

  seen.add(key)

  if (isPathCollidingWithChipInterior(path, chipObstacles)) {
    return {
      path,
      status: "chip-collision",
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
