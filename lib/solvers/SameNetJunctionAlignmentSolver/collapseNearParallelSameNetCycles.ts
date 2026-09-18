import type { Point } from "@tscircuit/math-utils"
import type { InlineNetLabelPlacement } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  getRailOrientation,
  nearlyEqual,
  pointsEqual,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"

const MAX_PARALLEL_CYCLE_SEPARATION = 0.05

interface CollapseNearParallelSameNetCyclesInput {
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  inlineNetLabelPlacements: InlineNetLabelPlacement[]
}

const getRange = (
  start: Point,
  end: Point,
  orientation: "horizontal" | "vertical",
) =>
  orientation === "horizontal"
    ? [Math.min(start.x, end.x), Math.max(start.x, end.x)]
    : [Math.min(start.y, end.y), Math.max(start.y, end.y)]

const getCoordinate = (point: Point, orientation: "horizontal" | "vertical") =>
  orientation === "horizontal" ? point.y : point.x

const getPathOnDonorSegment = ({
  targetStart,
  targetEnd,
  donorStart,
  orientation,
}: {
  targetStart: Point
  targetEnd: Point
  donorStart: Point
  orientation: "horizontal" | "vertical"
}): [Point, Point] => {
  const coordinate = getCoordinate(donorStart, orientation)
  return orientation === "horizontal"
    ? [
        { ...targetStart, y: coordinate },
        { ...targetEnd, y: coordinate },
      ]
    : [
        { ...targetStart, x: coordinate },
        { ...targetEnd, x: coordinate },
      ]
}

const hasAttachedLabel = ({
  trace,
  labels,
}: {
  trace: SolvedTracePath
  labels: Array<NetLabelPlacement | InlineNetLabelPlacement>
}) =>
  labels.some((label) => {
    const referencesTrace =
      ("mspPairId" in label && label.mspPairId === trace.mspPairId) ||
      ("mspConnectionPairIds" in label &&
        label.mspConnectionPairIds.includes(trace.mspPairId))
    return (
      referencesTrace ||
      tracePathContainsPoint(trace.tracePath, label.anchorPoint)
    )
  })

const findReplacementPath = ({
  targetTrace,
  traces,
}: {
  targetTrace: SolvedTracePath
  traces: SolvedTracePath[]
}): [Point, Point] | null => {
  // Moving an interior segment can create or erase adjacent elbows. Restrict
  // this cleanup to a complete bridge and leave general rail alignment to the
  // earlier SameNetJunctionAlignmentSolver.
  if (targetTrace.tracePath.length !== 2) return null
  const [targetStart, targetEnd] = targetTrace.tracePath as [Point, Point]
  const orientation = getRailOrientation(targetStart, targetEnd)
  if (!orientation) return null

  const otherSameNetTraces = traces.filter(
    (trace) =>
      trace.mspPairId !== targetTrace.mspPairId &&
      trace.globalConnNetId === targetTrace.globalConnNetId,
  )

  // Both ends must already meet other same-net geometry. This proves the
  // short-offset rail is a cycle, rather than a required route from a pin.
  if (
    ![targetStart, targetEnd].every((endpoint) =>
      otherSameNetTraces.some((trace) =>
        tracePathContainsPoint(trace.tracePath, endpoint),
      ),
    )
  ) {
    return null
  }

  const targetRange = getRange(targetStart, targetEnd, orientation)
  let best:
    | { path: [Point, Point]; separation: number; donorTraceId: string }
    | undefined

  for (const donorTrace of otherSameNetTraces) {
    for (let index = 0; index < donorTrace.tracePath.length - 1; index++) {
      const donorStart = donorTrace.tracePath[index]!
      const donorEnd = donorTrace.tracePath[index + 1]!
      if (getRailOrientation(donorStart, donorEnd) !== orientation) continue

      const donorRange = getRange(donorStart, donorEnd, orientation)
      if (
        !nearlyEqual(targetRange[0]!, donorRange[0]!) ||
        !nearlyEqual(targetRange[1]!, donorRange[1]!)
      ) {
        continue
      }

      const separation = Math.abs(
        getCoordinate(targetStart, orientation) -
          getCoordinate(donorStart, orientation),
      )
      if (
        nearlyEqual(separation, 0) ||
        separation > MAX_PARALLEL_CYCLE_SEPARATION
      ) {
        continue
      }

      const path = getPathOnDonorSegment({
        targetStart,
        targetEnd,
        donorStart,
        orientation,
      })
      if (
        !tracePathContainsPoint(donorTrace.tracePath, path[0]) ||
        !tracePathContainsPoint(donorTrace.tracePath, path[1])
      ) {
        continue
      }

      // Each old endpoint and its replacement must lie on one continuous
      // existing trace. Merely touching unrelated pieces of the same logical
      // net is not enough to prove that the visual route stays connected.
      if (
        ![0, 1].every((endpointIndex) =>
          otherSameNetTraces.some(
            (trace) =>
              tracePathContainsPoint(
                trace.tracePath,
                targetTrace.tracePath[endpointIndex]!,
              ) &&
              tracePathContainsPoint(trace.tracePath, path[endpointIndex]!),
          ),
        )
      ) {
        continue
      }

      if (
        !best ||
        separation < best.separation ||
        (nearlyEqual(separation, best.separation) &&
          donorTrace.mspPairId.localeCompare(best.donorTraceId) < 0)
      ) {
        best = { path, separation, donorTraceId: donorTrace.mspPairId }
      }
    }
  }

  return best?.path ?? null
}

/**
 * Collapses a redundant, near-parallel same-net bridge onto geometry that is
 * already present. Trace objects and connectivity metadata are preserved; only
 * the two points of the redundant bridge move.
 */
export const collapseNearParallelSameNetCycles = ({
  traces,
  netLabelPlacements,
  inlineNetLabelPlacements,
}: CollapseNearParallelSameNetCyclesInput) => {
  const outputTraces = [...traces]
  const labels = [...netLabelPlacements, ...inlineNetLabelPlacements]
  let collapsedCycleCount = 0

  for (let traceIndex = 0; traceIndex < outputTraces.length; traceIndex++) {
    const targetTrace = outputTraces[traceIndex]!
    if (hasAttachedLabel({ trace: targetTrace, labels })) continue

    const replacementPath = findReplacementPath({
      targetTrace,
      traces: outputTraces,
    })
    if (!replacementPath) continue
    if (
      pointsEqual(targetTrace.tracePath[0]!, replacementPath[0]) &&
      pointsEqual(targetTrace.tracePath[1]!, replacementPath[1])
    ) {
      continue
    }

    outputTraces[traceIndex] = {
      ...targetTrace,
      tracePath: replacementPath,
    }
    collapsedCycleCount++
  }

  return { traces: outputTraces, collapsedCycleCount }
}
