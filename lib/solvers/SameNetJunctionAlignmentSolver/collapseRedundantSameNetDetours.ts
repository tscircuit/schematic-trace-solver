import type { Point } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  getRailOrientation,
  getVisibleTraceLength,
  getVisibleTraceSegmentCount,
  pointsEqual,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import { preservesLabelAnchors } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/preservesLabelAnchors"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { PinId } from "lib/types/InputProblem"

interface CollapseRedundantSameNetDetoursInput {
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

interface PathCrossing {
  point: Point
  targetSegmentIndex: number
  donorSegmentIndex: number
}

interface DetourCandidate {
  tracePath: Point[]
  visibleLength: number
  visibleSegmentCount: number
}

const VISIBLE_LENGTH_EPSILON = 1e-6

const getSharedPinId = (
  firstTrace: SolvedTracePath,
  secondTrace: SolvedTracePath,
): PinId | null => {
  for (const firstPin of firstTrace.pins) {
    if (
      secondTrace.pins.some((secondPin) => secondPin.pinId === firstPin.pinId)
    ) {
      return firstPin.pinId
    }
  }
  return null
}

const getTracePathFromPin = ({
  trace,
  pinId,
}: {
  trace: SolvedTracePath
  pinId: PinId
}): Point[] | null => {
  const pin = trace.pins.find((candidatePin) => candidatePin.pinId === pinId)
  if (!pin) return null
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

const buildCandidatePath = ({
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

const getBestDetourCandidate = ({
  targetTrace,
  traces,
  netLabelPlacements,
}: {
  targetTrace: SolvedTracePath
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}): DetourCandidate | null => {
  const sameNetTraces = traces.filter(
    (trace) => trace.globalConnNetId === targetTrace.globalConnNetId,
  )
  const initialVisibleLength = getVisibleTraceLength(sameNetTraces)
  let bestCandidate: DetourCandidate | null = null

  for (const donorTrace of sameNetTraces) {
    if (donorTrace.mspPairId === targetTrace.mspPairId) continue
    const sharedPinId = getSharedPinId(targetTrace, donorTrace)
    if (!sharedPinId) continue
    const targetPath = getTracePathFromPin({
      trace: targetTrace,
      pinId: sharedPinId,
    })
    const donorPath = getTracePathFromPin({
      trace: donorTrace,
      pinId: sharedPinId,
    })
    if (!targetPath || !donorPath) continue

    const crossings = getPerpendicularPathCrossings({ targetPath, donorPath })
    for (const crossing of crossings) {
      const tracePath = buildCandidatePath({
        targetTrace,
        targetPath,
        donorPath,
        crossing,
      })
      const candidateTrace = { ...targetTrace, tracePath }
      if (
        !preservesLabelAnchors(
          netLabelPlacements,
          [targetTrace],
          [candidateTrace],
        )
      ) {
        continue
      }

      const candidateNetTraces = sameNetTraces.map((trace) => {
        if (trace.mspPairId === targetTrace.mspPairId) return candidateTrace
        return trace
      })
      const visibleLength = getVisibleTraceLength(candidateNetTraces)
      if (visibleLength >= initialVisibleLength - VISIBLE_LENGTH_EPSILON) {
        continue
      }
      const visibleSegmentCount =
        getVisibleTraceSegmentCount(candidateNetTraces)
      if (bestCandidate) {
        if (
          visibleLength >
          bestCandidate.visibleLength + VISIBLE_LENGTH_EPSILON
        ) {
          continue
        }
        if (
          Math.abs(visibleLength - bestCandidate.visibleLength) <=
            VISIBLE_LENGTH_EPSILON &&
          visibleSegmentCount >= bestCandidate.visibleSegmentCount
        ) {
          continue
        }
      }
      bestCandidate = { tracePath, visibleLength, visibleSegmentCount }
    }
  }

  return bestCandidate
}

export const collapseRedundantSameNetDetours = ({
  traces,
  netLabelPlacements,
}: CollapseRedundantSameNetDetoursInput) => {
  const outputTraces = [...traces]
  let collapsedDetourCount = 0
  let traceIndex = 0

  while (traceIndex < outputTraces.length) {
    const targetTrace = outputTraces[traceIndex]!
    const candidate = getBestDetourCandidate({
      targetTrace,
      traces: outputTraces,
      netLabelPlacements,
    })
    if (!candidate) {
      traceIndex++
      continue
    }

    outputTraces[traceIndex] = {
      ...targetTrace,
      tracePath: candidate.tracePath,
    }
    collapsedDetourCount++
    traceIndex = 0
  }

  return { traces: outputTraces, collapsedDetourCount }
}
