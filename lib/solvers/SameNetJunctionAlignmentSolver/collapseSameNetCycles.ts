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
import { getSharedPin } from "./alignSameNetJunctions"
import {
  pathEntersAnyNetLabel,
  pathIntersectsAnyNetLabel,
} from "./pathIntersectsAnyNetLabel"

interface CollapseSameNetCyclesInput {
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

interface PathCrossing {
  point: Point
  targetSegmentIndex: number
  donorSegmentIndex: number
}

interface CycleCollapseCandidate {
  tracePath: Point[]
  netLabelPlacements: NetLabelPlacement[]
  visibleLength: number
  visibleSegmentCount: number
}

const TRACE_LENGTH_EPSILON = 1e-6

const getTracePathStartingAtPin = ({
  trace,
  pin,
}: {
  trace: SolvedTracePath
  pin: Point
}): Point[] | null => {
  const pathStart = trace.tracePath[0]
  const pathEnd = trace.tracePath.at(-1)
  if (!pathStart || !pathEnd) return null
  if (pointsEqual(pathStart, pin)) return trace.tracePath
  if (pointsEqual(pathEnd, pin)) {
    return [...trace.tracePath].reverse()
  }
  return null
}

const getPerpendicularPathCrossings = ({
  targetPath,
  donorPath,
}: {
  targetPath: Point[]
  donorPath: Point[]
}): PathCrossing[] => {
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

      const point = getSegmentIntersection(
        targetStart,
        targetEnd,
        donorStart,
        donorEnd,
      )
      if (!point || pointsEqual(point, sharedEndpoint)) continue

      crossings.push({ point, targetSegmentIndex, donorSegmentIndex })
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
    crossing.point,
    ...targetPath.slice(crossing.targetSegmentIndex + 1),
  ])
  if (pointsEqual(targetTrace.tracePath[0]!, targetPath[0]!)) {
    return pathFromSharedPin
  }
  return pathFromSharedPin.reverse()
}

const candidatePreservesLabelAttachments = ({
  targetTrace,
  candidateTrace,
  netLabelPlacements,
  candidateNetLabelPlacements,
}: {
  targetTrace: SolvedTracePath
  candidateTrace: SolvedTracePath
  netLabelPlacements: NetLabelPlacement[]
  candidateNetLabelPlacements: NetLabelPlacement[]
}) =>
  netLabelPlacements.every((label, labelIndex) => {
    const wasAttached =
      label.globalConnNetId === targetTrace.globalConnNetId &&
      tracePathContainsPoint(targetTrace.tracePath, label.anchorPoint)
    if (!wasAttached) return true

    const candidateLabel = candidateNetLabelPlacements[labelIndex]!
    return tracePathContainsPoint(
      candidateTrace.tracePath,
      candidateLabel.anchorPoint,
    )
  })

const candidateAvoidsNetLabels = ({
  candidateTrace,
  netLabelPlacements,
}: {
  candidateTrace: SolvedTracePath
  netLabelPlacements: NetLabelPlacement[]
}) => {
  const otherNetLabelPlacements = netLabelPlacements.filter(
    (label) => label.globalConnNetId !== candidateTrace.globalConnNetId,
  )
  if (
    pathIntersectsAnyNetLabel({
      path: candidateTrace.tracePath,
      netLabelPlacements: otherNetLabelPlacements,
    })
  ) {
    return false
  }

  const sameNetLabelPlacements = netLabelPlacements.filter(
    (label) => label.globalConnNetId === candidateTrace.globalConnNetId,
  )
  return !pathEntersAnyNetLabel({
    path: candidateTrace.tracePath,
    netLabelPlacements: sameNetLabelPlacements,
  })
}

const candidateIsBetter = ({
  candidate,
  bestCandidate,
}: {
  candidate: CycleCollapseCandidate
  bestCandidate: CycleCollapseCandidate | null
}) => {
  if (!bestCandidate) return true
  if (
    candidate.visibleLength <
    bestCandidate.visibleLength - TRACE_LENGTH_EPSILON
  ) {
    return true
  }
  return (
    Math.abs(candidate.visibleLength - bestCandidate.visibleLength) <=
      TRACE_LENGTH_EPSILON &&
    candidate.visibleSegmentCount < bestCandidate.visibleSegmentCount
  )
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
  const initialVisibleLength = getVisibleTraceLength(sameNetTraces)
  const initialTargetLength = getVisibleTraceLength([targetTrace])
  let bestCandidate: CycleCollapseCandidate | null = null

  for (const donorTrace of sameNetTraces) {
    if (donorTrace.mspPairId === targetTrace.mspPairId) continue
    const sharedPin = getSharedPin({
      donorTrace,
      branchTrace: targetTrace,
    })
    if (!sharedPin) continue
    const targetPath = getTracePathStartingAtPin({
      trace: targetTrace,
      pin: sharedPin,
    })
    const donorPath = getTracePathStartingAtPin({
      trace: donorTrace,
      pin: sharedPin,
    })
    if (!targetPath || !donorPath) continue

    const crossings = getPerpendicularPathCrossings({ targetPath, donorPath })
    for (const crossing of crossings) {
      const tracePath = buildCollapsedCyclePath({
        targetTrace,
        targetPath,
        donorPath,
        crossing,
      })
      const candidateTrace = { ...targetTrace, tracePath }
      const candidateTargetLength = getVisibleTraceLength([candidateTrace])
      if (candidateTargetLength > initialTargetLength + TRACE_LENGTH_EPSILON) {
        continue
      }
      const candidateNetLabelPlacements = moveAttachedLabelsToReroutedTrace({
        trace: targetTrace,
        originalTracePath: targetTrace.tracePath,
        reroutedTracePath: tracePath,
        netLabelPlacements,
      })
      if (
        !candidatePreservesLabelAttachments({
          targetTrace,
          candidateTrace,
          netLabelPlacements,
          candidateNetLabelPlacements,
        }) ||
        !candidateAvoidsNetLabels({
          candidateTrace,
          netLabelPlacements: candidateNetLabelPlacements,
        })
      ) {
        continue
      }

      const candidateNetTraces = sameNetTraces.map((trace) => {
        if (trace.mspPairId === targetTrace.mspPairId) return candidateTrace
        return trace
      })
      const visibleLength = getVisibleTraceLength(candidateNetTraces)
      if (visibleLength >= initialVisibleLength - TRACE_LENGTH_EPSILON) {
        continue
      }
      const visibleSegmentCount =
        getVisibleTraceSegmentCount(candidateNetTraces)
      const candidate = {
        tracePath,
        netLabelPlacements: candidateNetLabelPlacements,
        visibleLength,
        visibleSegmentCount,
      }
      if (candidateIsBetter({ candidate, bestCandidate })) {
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
