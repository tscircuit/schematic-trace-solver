import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const DEFAULT_ALIGNMENT_TOLERANCE = 0.1
const EPS = 1e-9

type Axis = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  segmentIndex: number
  axis: Axis
  fixedCoord: number
  rangeStart: number
  rangeEnd: number
}

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  tracePath: trace.tracePath.map((point) => ({ ...point })),
})

const getSegmentRef = (
  trace: SolvedTracePath,
  traceIndex: number,
  segmentIndex: number,
): SegmentRef | null => {
  const a = trace.tracePath[segmentIndex]!
  const b = trace.tracePath[segmentIndex + 1]!

  if (Math.abs(a.y - b.y) < EPS) {
    return {
      traceIndex,
      segmentIndex,
      axis: "horizontal",
      fixedCoord: (a.y + b.y) / 2,
      rangeStart: Math.min(a.x, b.x),
      rangeEnd: Math.max(a.x, b.x),
    }
  }

  if (Math.abs(a.x - b.x) < EPS) {
    return {
      traceIndex,
      segmentIndex,
      axis: "vertical",
      fixedCoord: (a.x + b.x) / 2,
      rangeStart: Math.min(a.y, b.y),
      rangeEnd: Math.max(a.y, b.y),
    }
  }

  return null
}

const rangesTouchOrOverlap = (
  a: SegmentRef,
  b: SegmentRef,
  tolerance: number,
) =>
  Math.max(a.rangeStart, b.rangeStart) <=
  Math.min(a.rangeEnd, b.rangeEnd) + tolerance

const canMoveSegment = (trace: SolvedTracePath, segmentIndex: number) =>
  segmentIndex > 0 && segmentIndex < trace.tracePath.length - 2

const applyFixedCoord = (
  tracePath: Point[],
  segmentIndex: number,
  axis: Axis,
  fixedCoord: number,
) => {
  const a = tracePath[segmentIndex]!
  const b = tracePath[segmentIndex + 1]!

  if (axis === "horizontal") {
    a.y = fixedCoord
    b.y = fixedCoord
  } else {
    a.x = fixedCoord
    b.x = fixedCoord
  }
}

export const alignNearbySameNetSegments = (
  traces: SolvedTracePath[],
  tolerance = DEFAULT_ALIGNMENT_TOLERANCE,
): SolvedTracePath[] => {
  const outputTraces = traces.map(cloneTrace)
  const tracesByNet = new Map<string, number[]>()

  for (let i = 0; i < outputTraces.length; i++) {
    const trace = outputTraces[i]!
    const traceIndexes = tracesByNet.get(trace.globalConnNetId) ?? []
    traceIndexes.push(i)
    tracesByNet.set(trace.globalConnNetId, traceIndexes)
  }

  for (const traceIndexes of tracesByNet.values()) {
    const segments: SegmentRef[] = []

    for (const traceIndex of traceIndexes) {
      const trace = outputTraces[traceIndex]!
      for (
        let segmentIndex = 0;
        segmentIndex < trace.tracePath.length - 1;
        segmentIndex++
      ) {
        if (!canMoveSegment(trace, segmentIndex)) continue
        const segment = getSegmentRef(trace, traceIndex, segmentIndex)
        if (segment) segments.push(segment)
      }
    }

    const visited = new Set<number>()
    for (let i = 0; i < segments.length; i++) {
      if (visited.has(i)) continue

      const group = [segments[i]!]
      visited.add(i)

      for (let j = i + 1; j < segments.length; j++) {
        if (visited.has(j)) continue
        const candidate = segments[j]!
        if (
          candidate.axis === group[0]!.axis &&
          Math.abs(candidate.fixedCoord - group[0]!.fixedCoord) <= tolerance &&
          group.some((segment) =>
            rangesTouchOrOverlap(segment, candidate, tolerance),
          )
        ) {
          group.push(candidate)
          visited.add(j)
        }
      }

      if (group.length < 2) continue

      const fixedCoord =
        group.reduce((sum, segment) => sum + segment.fixedCoord, 0) /
        group.length

      for (const segment of group) {
        applyFixedCoord(
          outputTraces[segment.traceIndex]!.tracePath,
          segment.segmentIndex,
          segment.axis,
          fixedCoord,
        )
      }
    }
  }

  return outputTraces
}
