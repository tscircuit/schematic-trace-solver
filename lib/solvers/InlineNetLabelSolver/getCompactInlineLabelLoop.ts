import type { Point } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { findFirstCollision } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { shiftSegmentOrth } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/pathOps"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import {
  doesPathCoincideWithTraces,
  doesPathOverlapTraceStrokes,
} from "lib/utils/doesPathCoincideWithTraces"
import { getSameNetJunctions } from "lib/utils/getSameNetJunctions"
import type { InlineNetLabelPlacement } from "./InlineNetLabelSolver"

const EPS = 1e-6
const INLINE_LABEL_END_CLEARANCE = 0.05

/** Offer a shorter same-side U with room for the existing label on one leg. */
export const getCompactInlineLabelLoop = (
  inputProblem: InputProblem,
  trace: SolvedTracePath,
  label: InlineNetLabelPlacement,
  otherTraces: SolvedTracePath[],
): Point[] | null => {
  const { tracePath, pins } = trace
  if (
    tracePath.length !== 4 ||
    trace.pinIds.length !== 2 ||
    pins[0].chipId !== pins[1].chipId
  )
    return null
  const [start, elbowStart, elbowEnd, end] = tracePath as [
    Point,
    Point,
    Point,
    Point,
  ]
  if (
    !pins.every((pin) =>
      [start, end].some(
        (point) => Math.hypot(pin.x - point.x, pin.y - point.y) < EPS,
      ),
    )
  )
    return null
  const along = label.axis
  const across = along === "x" ? "y" : "x"
  const direction = Math.sign(elbowStart[along] - start[along])
  if (
    Math.abs(start[across] - elbowStart[across]) > EPS ||
    Math.abs(end[across] - elbowEnd[across]) > EPS ||
    Math.sign(elbowEnd[along] - end[along]) !== direction ||
    direction === 0
  )
    return null

  const outermostPin = Math.max(
    direction * start[along],
    direction * end[along],
  )
  const clearance = label.width + 2 * INLINE_LABEL_END_CLEARANCE
  const compactElbow = direction * (outermostPin + clearance)
  if (direction * (elbowStart[along] - compactElbow) <= EPS) return null
  const candidate = shiftSegmentOrth(tracePath, 1, along, compactElbow)
  if (!candidate) return null

  // The legs are shortened in place. Only the crossbar occupies new space.
  const crossbar = [candidate[1]!, candidate[2]!]
  if (findFirstCollision(crossbar, getObstacleRects(inputProblem))) return null
  if (doesPathOverlapTraceStrokes(crossbar, otherTraces)) return null
  if (
    otherTraces.some(({ tracePath }) =>
      tracePath
        .slice(1)
        .some((point, index) =>
          getSegmentIntersection(
            crossbar[0]!,
            crossbar[1]!,
            tracePath[index]!,
            point,
          ),
        ),
    )
  )
    return null
  if (
    inputProblem.chips.some((chip) =>
      chip.pins.some((pin) => tracePathContainsPoint(crossbar, pin)),
    )
  )
    return null

  const sameNetTraces = otherTraces.filter(
    (other) => other.globalConnNetId === trace.globalConnNetId,
  )
  const removedPath = [candidate[1]!, elbowStart, elbowEnd, candidate[2]!]
  if (
    doesPathCoincideWithTraces(removedPath, sameNetTraces) ||
    getSameNetJunctions(trace, sameNetTraces).some(
      (junction) => !tracePathContainsPoint(candidate, junction),
    )
  )
    return null

  return candidate
}
