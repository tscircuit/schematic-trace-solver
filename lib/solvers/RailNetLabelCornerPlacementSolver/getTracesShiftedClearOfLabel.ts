import {
  segmentCrossesBoundsInterior,
  traceCrossesBoundsInterior,
} from "lib/solvers/AvailableNetOrientationSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { EPS, tracePathContainsPoint } from "./geometry"
import type { Bounds } from "./types"

const LABEL_TRACE_CLEARANCE = 0.1

export const getTracesShiftedClearOfLabel = ({
  bounds,
  traces,
}: {
  bounds: Bounds
  traces: SolvedTracePath[]
}): SolvedTracePath[] | null => {
  const shiftedTraces: SolvedTracePath[] = []
  for (const trace of traces) {
    if (!traceCrossesBoundsInterior(bounds, { [trace.mspPairId]: trace }))
      continue
    const path = trace.tracePath.map((point) => ({ ...point }))
    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i]!
      const end = path[i + 1]!
      if (!segmentCrossesBoundsInterior(start, end, bounds)) continue
      if (
        i === 0 ||
        i + 1 === path.length - 1 ||
        Math.abs(start.y - end.y) > EPS
      )
        return null
      const previousPoint = path[i - 1]!
      const nextPoint = path[i + 2]!
      let y = bounds.maxY + LABEL_TRACE_CLEARANCE
      if (previousPoint.y < start.y && nextPoint.y < end.y) {
        y = bounds.minY - LABEL_TRACE_CLEARANCE
      } else if (previousPoint.y <= start.y || nextPoint.y <= end.y) {
        return null
      }
      if (
        (previousPoint.y - y) * (previousPoint.y - start.y) <= EPS ||
        (nextPoint.y - y) * (nextPoint.y - end.y) <= EPS
      )
        return null
      start.y = y
      end.y = y
    }
    if (
      traces.some(
        (otherTrace) =>
          otherTrace !== trace &&
          otherTrace.globalConnNetId === trace.globalConnNetId &&
          otherTrace.tracePath.some(
            (point) =>
              tracePathContainsPoint(trace.tracePath, point) &&
              !tracePathContainsPoint(path, point),
          ),
      )
    )
      return null
    shiftedTraces.push({ ...trace, tracePath: path })
  }
  return shiftedTraces
}
