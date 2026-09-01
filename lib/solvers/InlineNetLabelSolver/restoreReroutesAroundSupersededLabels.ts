import type { Point } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { preservesLabelAnchors } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/preservesLabelAnchors"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import type { CompletedTraceReroute } from "lib/solvers/TraceElbowTransitionSimplificationSolver/types"
import type { InputProblem } from "lib/types/InputProblem"
import {
  doesPathCoincideWithPaths,
  doesPathCoincideWithTraces,
} from "lib/utils/doesPathCoincideWithTraces"
import { pathIntersectsRenderedLabel } from "lib/utils/pathIntersectsRenderedLabel"
import type { InlineNetLabelPlacement } from "./InlineNetLabelSolver"

const EPS = 1e-6

const getPathLength = (path: Point[]) =>
  path.slice(1).reduce((length, point, pointIndex) => {
    const previousPoint = path[pointIndex]!
    return (
      length +
      Math.abs(point.x - previousPoint.x) +
      Math.abs(point.y - previousPoint.y)
    )
  }, 0)

const pathsEqual = (first: Point[], second: Point[]) =>
  first.length === second.length &&
  first.every(
    (point, index) =>
      Math.abs(point.x - second[index]!.x) <= EPS &&
      Math.abs(point.y - second[index]!.y) <= EPS,
  )

const isStrictlySimpler = (candidate: Point[], current: Point[]) =>
  candidate.length < current.length &&
  getPathLength(candidate) <= getPathLength(current) + EPS

const getIntersectionKeys = (path: Point[], otherPath: Point[]) => {
  const intersections = new Set<string>()
  for (let pathIndex = 0; pathIndex < path.length - 1; pathIndex++) {
    for (
      let otherPathIndex = 0;
      otherPathIndex < otherPath.length - 1;
      otherPathIndex++
    ) {
      const point = getSegmentIntersection(
        path[pathIndex]!,
        path[pathIndex + 1]!,
        otherPath[otherPathIndex]!,
        otherPath[otherPathIndex + 1]!,
      )
      if (point) {
        intersections.add(`${point.x.toFixed(6)},${point.y.toFixed(6)}`)
      }
    }
  }
  return intersections
}

const introducesNewCrossings = (
  candidatePath: Point[],
  currentPath: Point[],
  otherPaths: Point[][],
) =>
  otherPaths.some((otherPath) => {
    const currentIntersections = getIntersectionKeys(currentPath, otherPath)
    const candidateIntersections = getIntersectionKeys(candidatePath, otherPath)
    return [...candidateIntersections].some(
      (intersection) => !currentIntersections.has(intersection),
    )
  })

/**
 * Restores a trace's recorded pre-collision path when the anchored net label
 * that caused its reroute was later replaced by an inline label.
 *
 * A reroute is unwound only when its current geometry still matches the
 * recorded result and the original path is strictly simpler without creating
 * collisions, crossings, overlaps, or detached label anchors.
 */
export const restoreReroutesAroundSupersededLabels = ({
  inputProblem,
  traces,
  netLabelPlacements,
  inlineNetLabelPlacements,
  completedReroutes,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  inlineNetLabelPlacements: InlineNetLabelPlacement[]
  completedReroutes: CompletedTraceReroute[]
}) => {
  const outputTraces = [...traces]
  const supersededLabelGlobalConnNetIds = new Set(
    inlineNetLabelPlacements.map((placement) => placement.globalConnNetId),
  )
  const obstacles = getObstacleRects(inputProblem)
  let restoredTraceCount = 0

  // A trace can be rerouted more than once. Unwind only unchanged reroutes,
  // newest first, so every restoration has exact provenance.
  for (const reroute of [...completedReroutes].reverse()) {
    if (!supersededLabelGlobalConnNetIds.has(reroute.label.globalConnNetId)) {
      continue
    }

    const traceIndex = outputTraces.findIndex(
      (trace) => trace.mspPairId === reroute.initialTrace.mspPairId,
    )
    if (traceIndex < 0) continue

    const currentTrace = outputTraces[traceIndex]!
    const currentPath = simplifyPath(currentTrace.tracePath)
    const recordedReroutePath = simplifyPath(reroute.reroutedTracePath)
    if (!pathsEqual(currentPath, recordedReroutePath)) continue

    const candidatePath = simplifyPath(reroute.initialTrace.tracePath)
    if (!isStrictlySimpler(candidatePath, currentPath)) continue

    const candidateTrace = { ...currentTrace, tracePath: candidatePath }
    const otherNetTraces = outputTraces.filter(
      (trace) =>
        trace.mspPairId !== currentTrace.mspPairId &&
        trace.globalConnNetId !== currentTrace.globalConnNetId,
    )
    const otherNetInlineLabels = inlineNetLabelPlacements.filter(
      (label) => label.globalConnNetId !== currentTrace.globalConnNetId,
    )
    const otherNetInlineStubPaths = otherNetInlineLabels.flatMap((label) =>
      label.stubTracePath ? [[...label.stubTracePath]] : [],
    )

    if (
      isPathCollidingWithObstacles(candidatePath, obstacles) ||
      detectTraceLabelOverlap({
        traces: [candidateTrace],
        netLabels: netLabelPlacements,
      }).length > 0 ||
      otherNetInlineLabels.some((label) =>
        pathIntersectsRenderedLabel(candidatePath, label),
      ) ||
      doesPathCoincideWithTraces(candidatePath, otherNetTraces) ||
      doesPathCoincideWithPaths(candidatePath, otherNetInlineStubPaths) ||
      introducesNewCrossings(
        candidatePath,
        currentPath,
        otherNetTraces.map((trace) => trace.tracePath),
      ) ||
      introducesNewCrossings(
        candidatePath,
        currentPath,
        otherNetInlineStubPaths,
      ) ||
      !preservesLabelAnchors(
        netLabelPlacements,
        [currentTrace],
        [candidateTrace],
      )
    ) {
      continue
    }

    outputTraces[traceIndex] = candidateTrace
    restoredTraceCount++
  }

  return { traces: outputTraces, restoredTraceCount }
}
