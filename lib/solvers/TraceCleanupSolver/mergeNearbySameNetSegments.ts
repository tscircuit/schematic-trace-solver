import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

type SegmentOrientation = "horizontal" | "vertical"

interface TraceSegment {
  traceIndex: number
  segmentIndex: number
  netId: string
  orientation: SegmentOrientation
  fixedCoord: number
  rangeStart: number
  rangeEnd: number
  length: number
  movable: boolean
}

const DEFAULT_CLOSE_SEGMENT_DISTANCE = 0.18
const EPSILON = 1e-9

const getNetId = (trace: SolvedTracePath): string =>
  trace.globalConnNetId || trace.dcConnNetId || trace.mspPairId

const getSegmentOrientation = (
  start: Point,
  end: Point,
): SegmentOrientation | null => {
  if (
    Math.abs(start.y - end.y) < EPSILON &&
    Math.abs(start.x - end.x) > EPSILON
  ) {
    return "horizontal"
  }

  if (
    Math.abs(start.x - end.x) < EPSILON &&
    Math.abs(start.y - end.y) > EPSILON
  ) {
    return "vertical"
  }

  return null
}

const rangesOverlap = (a: TraceSegment, b: TraceSegment): boolean =>
  Math.max(a.rangeStart, b.rangeStart) <=
  Math.min(a.rangeEnd, b.rangeEnd) + EPSILON

const shouldGroupSegments = (
  a: TraceSegment,
  b: TraceSegment,
  distance: number,
): boolean =>
  a.netId === b.netId &&
  a.orientation === b.orientation &&
  Math.abs(a.fixedCoord - b.fixedCoord) <= distance &&
  rangesOverlap(a, b) &&
  (a.movable || b.movable)

const findRoot = (parents: number[], index: number): number => {
  let root = index
  while (parents[root] !== root) root = parents[root]

  while (parents[index] !== index) {
    const next = parents[index]
    parents[index] = root
    index = next
  }

  return root
}

const union = (parents: number[], a: number, b: number) => {
  const rootA = findRoot(parents, a)
  const rootB = findRoot(parents, b)
  if (rootA !== rootB) parents[rootB] = rootA
}

const collectSegments = (traces: SolvedTracePath[]): TraceSegment[] => {
  const segments: TraceSegment[] = []

  for (const [traceIndex, trace] of traces.entries()) {
    for (
      let segmentIndex = 0;
      segmentIndex < trace.tracePath.length - 1;
      segmentIndex++
    ) {
      const start = trace.tracePath[segmentIndex]
      const end = trace.tracePath[segmentIndex + 1]
      const orientation = getSegmentOrientation(start, end)
      if (!orientation) continue

      const rangeStart =
        orientation === "horizontal"
          ? Math.min(start.x, end.x)
          : Math.min(start.y, end.y)
      const rangeEnd =
        orientation === "horizontal"
          ? Math.max(start.x, end.x)
          : Math.max(start.y, end.y)
      const fixedCoord = orientation === "horizontal" ? start.y : start.x

      segments.push({
        traceIndex,
        segmentIndex,
        netId: getNetId(trace),
        orientation,
        fixedCoord,
        rangeStart,
        rangeEnd,
        length: rangeEnd - rangeStart,
        movable: segmentIndex > 0 && segmentIndex < trace.tracePath.length - 2,
      })
    }
  }

  return segments
}

const chooseTargetFixedCoord = (segments: TraceSegment[]): number => {
  const longestSegment = segments.reduce((longest, segment) =>
    segment.length > longest.length ? segment : longest,
  )

  return longestSegment.fixedCoord
}

export const mergeNearbySameNetSegments = (
  traces: SolvedTracePath[],
  distance = DEFAULT_CLOSE_SEGMENT_DISTANCE,
): SolvedTracePath[] => {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))
  const segments = collectSegments(outputTraces)

  if (segments.length < 2) return outputTraces

  const parents = segments.map((_, index) => index)

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (shouldGroupSegments(segments[i], segments[j], distance)) {
        union(parents, i, j)
      }
    }
  }

  const groups = new Map<number, TraceSegment[]>()
  for (const [index, segment] of segments.entries()) {
    const root = findRoot(parents, index)
    const group = groups.get(root) ?? []
    group.push(segment)
    groups.set(root, group)
  }

  for (const group of groups.values()) {
    if (group.length < 2 || !group.some((segment) => segment.movable)) {
      continue
    }

    const targetFixedCoord = chooseTargetFixedCoord(group)

    for (const segment of group) {
      if (!segment.movable) continue

      const tracePath = outputTraces[segment.traceIndex].tracePath
      const start = tracePath[segment.segmentIndex]
      const end = tracePath[segment.segmentIndex + 1]

      if (segment.orientation === "horizontal") {
        start.y = targetFixedCoord
        end.y = targetFixedCoord
      } else {
        start.x = targetFixedCoord
        end.x = targetFixedCoord
      }
    }
  }

  return outputTraces.map((trace) => ({
    ...trace,
    tracePath: simplifyPath(trace.tracePath),
  }))
}
