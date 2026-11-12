import type { Point } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getVisibleTraceLength } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputProblem } from "lib/types/InputProblem"

const pathsTouch = (first: Point[], second: Point[]) =>
  first.some((point) => tracePathContainsPoint(second, point)) ||
  second.some((point) => tracePathContainsPoint(first, point)) ||
  first
    .slice(1)
    .some((end, index) =>
      second
        .slice(1)
        .some((otherEnd, otherIndex) =>
          getSegmentIntersection(
            first[index]!,
            end,
            second[otherIndex]!,
            otherEnd,
          ),
        ),
    )

/** Remove a terminal loop edge only when the remaining net already connects it. */
export const removeRedundantTerminalSegments = ({
  inputProblem,
  traces,
  netLabelPlacements,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}): SolvedTracePath[] => {
  const output = [...traces]
  const anchors = [
    ...inputProblem.chips.flatMap((chip) => chip.pins),
    ...netLabelPlacements.map((label) => label.anchorPoint),
  ]
  for (let index = 0; index < output.length; index++) {
    const trace = output[index]!
    const others = output.filter(
      (other) =>
        other.mspPairId !== trace.mspPairId &&
        other.globalConnNetId === trace.globalConnNetId,
    )
    let path = trace.tracePath
    for (const reverse of [false, true]) {
      if (reverse) path = [...path].reverse()
      while (path.length > 2) {
        const segment = path.slice(-2)
        const remaining = path.slice(0, -1)
        // Leave coincident shared stubs alone; this pass only removes loop edges
        // that contribute a separate visible stroke.
        if (
          getVisibleTraceLength([
            ...others,
            { ...trace, tracePath: segment },
          ]) <=
          getVisibleTraceLength(others) + 1e-6
        )
          break
        const connected = new Set(
          others.filter((other) =>
            tracePathContainsPoint(other.tracePath, segment[0]!),
          ),
        )
        for (const host of connected) {
          for (const other of others) {
            if (
              !connected.has(other) &&
              pathsTouch(host.tracePath, other.tracePath)
            ) {
              connected.add(other)
            }
          }
        }
        if (
          ![...connected].some((other) =>
            tracePathContainsPoint(other.tracePath, segment[1]!),
          ) ||
          others.some(
            (other) =>
              pathsTouch(segment, other.tracePath) && !connected.has(other),
          ) ||
          anchors.some(
            (anchor) =>
              tracePathContainsPoint(segment, anchor) &&
              !tracePathContainsPoint(remaining, anchor) &&
              ![...connected].some((other) =>
                tracePathContainsPoint(other.tracePath, anchor),
              ),
          )
        )
          break
        path = remaining
      }
      if (reverse) path = [...path].reverse()
    }
    if (path.length !== trace.tracePath.length)
      output[index] = { ...trace, tracePath: path }
  }
  return output
}
