import type { Point } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import { moveAttachedLabelsToReroutedTrace } from "lib/solvers/Example28Solver/labelMovement"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  getRailOrientation,
  getVisibleTraceLength,
  getVisibleTraceSegmentCount,
  pointsEqual,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { getSharedPin } from "./getSharedPin"
import {
  pathEntersAnyNetLabel,
  pathIntersectsAnyNetLabel,
} from "./pathIntersectsAnyNetLabel"

interface CollapseSameNetCyclesInput {
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

interface PathCrossing {
  intersectionPoint: Point
  targetSegmentIndex: number
  donorSegmentIndex: number
}

interface CycleCollapseCandidate {
  tracePath: Point[]
  netLabelPlacements: NetLabelPlacement[]
  netVisibleLength: number
  netVisibleSegmentCount: number
}

const TRACE_LENGTH_EPSILON = 1e-6

const getTracePathStartingAtPin = (
  trace: SolvedTracePath,
  pin: Point,
): Point[] | null => {
  const pathStart = trace.tracePath[0]
  const pathEnd = trace.tracePath.at(-1)
  if (!pathStart || !pathEnd) return null
  if (pointsEqual(pathStart, pin)) return trace.tracePath
  if (pointsEqual(pathEnd, pin)) return [...trace.tracePath].reverse()
  return null
}

const getPerpendicularPathCrossings = (
  targetPath: Point[],
  donorPath: Point[],
): PathCrossing[] => {
  const crossings: PathCrossing[] = []
  const sharedEndpoint = targetPath[0]!

  for (
    let targetSegmentIndex = 0;
    targetSegmentIndex < targetPath.length - 1;
    targetSegmentIndex++
  ) {
    const targetStart = targetPath[targetSegmentIndex]!
    const targetEnd = targetPath[targetSegmentIndex + 1]!
    const targetOrientation = getRailOrientation(targetStart, targetEnd)
    if (!targetOrientation) continue

    for (
      let donorSegmentIndex = 0;
      donorSegmentIndex < donorPath.length - 1;
      donorSegmentIndex++
    ) {
      const donorStart = donorPath[donorSegmentIndex]!
      const donorEnd = donorPath[donorSegmentIndex + 1]!
      const donorOrientation = getRailOrientation(donorStart, donorEnd)
      if (!donorOrientation || donorOrientation === targetOrientation) continue

      const intersectionPoint = getSegmentIntersection(
        targetStart,
        targetEnd,
        donorStart,
        donorEnd,
      )
      if (
        !intersectionPoint ||
        pointsEqual(intersectionPoint, sharedEndpoint)
      ) {
        continue
      }

      crossings.push({
        intersectionPoint,
        targetSegmentIndex,
        donorSegmentIndex,
      })
    }
  }

  return crossings
}

const buildCollapsedCyclePath = ({
  targetTrace,
  targetPath,
  donorPath,
  crossing,
}: {
  targetTrace: SolvedTracePath
  targetPath: Point[]
  donorPath: Point[]
  crossing: PathCrossing
}) => {
  const pathFromSharedPin = simplifyPath([
    ...donorPath.slice(0, crossing.donorSegmentIndex + 1),
    crossing.intersectionPoint,
    ...targetPath.slice(crossing.targetSegmentIndex + 1),
  ])
  if (pointsEqual(targetTrace.tracePath[0]!, targetPath[0]!)) {
    return pathFromSharedPin
  }
  return pathFromSharedPin.reverse()
}

const getNetLabelPlacementsForCycleCollapse = ({
  targetTrace,
  tracePath,
  netLabelPlacements,
}: {
  targetTrace: SolvedTracePath
  tracePath: Point[]
  netLabelPlacements: NetLabelPlacement[]
}): NetLabelPlacement[] | null => {
  const candidateNetLabelPlacements = moveAttachedLabelsToReroutedTrace({
    trace: targetTrace,
    originalTracePath: targetTrace.tracePath,
    reroutedTracePath: tracePath,
    netLabelPlacements,
  })

  for (
    let labelIndex = 0;
    labelIndex < netLabelPlacements.length;
    labelIndex++
  ) {
    const label = netLabelPlacements[labelIndex]!
    if (label.globalConnNetId !== targetTrace.globalConnNetId) continue
    if (!tracePathContainsPoint(targetTrace.tracePath, label.anchorPoint)) {
      continue
    }
    const candidateLabel = candidateNetLabelPlacements[labelIndex]!
    if (!tracePathContainsPoint(tracePath, candidateLabel.anchorPoint)) {
      return null
    }
  }

  const otherNetLabelPlacements = candidateNetLabelPlacements.filter(
    (label) => label.globalConnNetId !== targetTrace.globalConnNetId,
  )
  if (
    pathIntersectsAnyNetLabel({
      path: tracePath,
      netLabelPlacements: otherNetLabelPlacements,
    })
  ) {
    return null
  }

  const sameNetLabelPlacements = candidateNetLabelPlacements.filter(
    (label) => label.globalConnNetId === targetTrace.globalConnNetId,
  )
  if (
    pathEntersAnyNetLabel({
      path: tracePath,
      netLabelPlacements: sameNetLabelPlacements,
    })
  ) {
    return null
  }
  return candidateNetLabelPlacements
}

const candidateIsBetter = (
  candidate: CycleCollapseCandidate,
  bestCandidate: CycleCollapseCandidate | null,
) => {
  if (!bestCandidate) return true
  const visibleLengthDelta =
    candidate.netVisibleLength - bestCandidate.netVisibleLength
  if (Math.abs(visibleLengthDelta) > TRACE_LENGTH_EPSILON) {
    return visibleLengthDelta < 0
  }
  return candidate.netVisibleSegmentCount < bestCandidate.netVisibleSegmentCount
}

const getBestCycleCollapseCandidate = ({
  targetTrace,
  traces,
  netLabelPlacements,
}: {
  targetTrace: SolvedTracePath
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}): CycleCollapseCandidate | null => {
  const sameNetTraces = traces.filter(
    (trace) => trace.globalConnNetId === targetTrace.globalConnNetId,
  )
  const baselineNetVisibleLength = getVisibleTraceLength(sameNetTraces)
  const baselineTargetVisibleLength = getVisibleTraceLength([targetTrace])
  let bestCandidate: CycleCollapseCandidate | null = null

  for (const donorTrace of sameNetTraces) {
    if (donorTrace.mspPairId === targetTrace.mspPairId) continue
    const sharedPin = getSharedPin({
      donorTrace,
      branchTrace: targetTrace,
    })
    if (!sharedPin) continue
    const targetPath = getTracePathStartingAtPin(targetTrace, sharedPin)
    const donorPath = getTracePathStartingAtPin(donorTrace, sharedPin)
    if (!targetPath || !donorPath) continue

    const crossings = getPerpendicularPathCrossings(targetPath, donorPath)
    for (const crossing of crossings) {
      const tracePath = buildCollapsedCyclePath({
        targetTrace,
        targetPath,
        donorPath,
        crossing,
      })
      const candidateTrace = { ...targetTrace, tracePath }
      const candidateTargetVisibleLength = getVisibleTraceLength([
        candidateTrace,
      ])
      if (
        candidateTargetVisibleLength >
        baselineTargetVisibleLength + TRACE_LENGTH_EPSILON
      ) {
        continue
      }
      const candidateNetLabelPlacements = getNetLabelPlacementsForCycleCollapse(
        {
          targetTrace,
          tracePath,
          netLabelPlacements,
        },
      )
      if (!candidateNetLabelPlacements) continue

      const candidateNetTraces = sameNetTraces.map((trace) => {
        if (trace.mspPairId === targetTrace.mspPairId) return candidateTrace
        return trace
      })
      const netVisibleLength = getVisibleTraceLength(candidateNetTraces)
      if (netVisibleLength >= baselineNetVisibleLength - TRACE_LENGTH_EPSILON) {
        continue
      }
      const netVisibleSegmentCount =
        getVisibleTraceSegmentCount(candidateNetTraces)
      const candidate = {
        tracePath,
        netLabelPlacements: candidateNetLabelPlacements,
        netVisibleLength,
        netVisibleSegmentCount,
      }
      if (candidateIsBetter(candidate, bestCandidate)) {
        bestCandidate = candidate
      }
    }
  }

  return bestCandidate
}

export const collapseSameNetCycles = ({
  traces,
  netLabelPlacements,
}: CollapseSameNetCyclesInput) => {
  const outputTraces = [...traces]
  let outputNetLabelPlacements = [...netLabelPlacements]
  let collapsedCycleCount = 0
  let traceIndex = 0

  while (traceIndex < outputTraces.length) {
    const targetTrace = outputTraces[traceIndex]!
    const candidate = getBestCycleCollapseCandidate({
      targetTrace,
      traces: outputTraces,
      netLabelPlacements: outputNetLabelPlacements,
    })
    if (!candidate) {
      traceIndex++
      continue
    }

    outputTraces[traceIndex] = {
      ...targetTrace,
      tracePath: candidate.tracePath,
    }
    outputNetLabelPlacements = candidate.netLabelPlacements
    collapsedCycleCount++
    traceIndex = 0
  }

  return {
    traces: outputTraces,
    netLabelPlacements: outputNetLabelPlacements,
    collapsedCycleCount,
  }
}
