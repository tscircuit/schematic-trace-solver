import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const AXIS_EPSILON = 1e-3
const MERGE_GAP_EPSILON = 1e-3

type Orientation = "vertical" | "horizontal"

type SegmentTrace = {
  trace: SolvedTracePath
  orientation: Orientation
  axisValue: number
  start: number
  end: number
}

const toAxisBucketKey = (value: number) =>
  `${Math.round(value / AXIS_EPSILON) * AXIS_EPSILON}`

const isVerticalSegment = (p1: Point, p2: Point) =>
  Math.abs(p1.x - p2.x) <= AXIS_EPSILON

const isHorizontalSegment = (p1: Point, p2: Point) =>
  Math.abs(p1.y - p2.y) <= AXIS_EPSILON

const getTraceNetId = (trace: SolvedTracePath) =>
  trace.userNetId ?? trace.globalConnNetId

const uniqueStrings = (values: string[]) => [...new Set(values)]

const distance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

const findNearestPin = (
  target: Point,
  traces: SolvedTracePath[],
): SolvedTracePath["pins"][number] => {
  const candidates = traces.flatMap((trace) => trace.pins)
  let nearest = candidates[0]!
  let minDistance = distance(target, nearest)

  for (let i = 1; i < candidates.length; i++) {
    const candidate = candidates[i]!
    const candidateDistance = distance(target, candidate)
    if (candidateDistance < minDistance) {
      minDistance = candidateDistance
      nearest = candidate
    }
  }

  return nearest
}

const buildMergedTrace = (
  orientation: Orientation,
  axisValue: number,
  start: number,
  end: number,
  members: SolvedTracePath[],
): SolvedTracePath => {
  const firstMember = members[0]!
  const mspConnectionPairIds = uniqueStrings(
    members.flatMap((trace) => trace.mspConnectionPairIds),
  )
  const pinIds = uniqueStrings(members.flatMap((trace) => trace.pinIds))
  const tracePath: Point[] =
    orientation === "vertical"
      ? [
          { x: axisValue, y: start },
          { x: axisValue, y: end },
        ]
      : [
          { x: start, y: axisValue },
          { x: end, y: axisValue },
        ]

  return {
    ...firstMember,
    mspPairId: mspConnectionPairIds.join("__"),
    mspConnectionPairIds,
    pinIds,
    pins: [
      findNearestPin(tracePath[0]!, members),
      findNearestPin(tracePath[tracePath.length - 1]!, members),
    ],
    tracePath,
  }
}

const getSegmentTrace = (trace: SolvedTracePath): SegmentTrace | null => {
  if (trace.tracePath.length !== 2) return null
  const [p1, p2] = trace.tracePath
  if (!p1 || !p2) return null

  if (isVerticalSegment(p1, p2)) {
    const axisValue = (p1.x + p2.x) / 2
    return {
      trace,
      orientation: "vertical",
      axisValue,
      start: Math.min(p1.y, p2.y),
      end: Math.max(p1.y, p2.y),
    }
  }

  if (isHorizontalSegment(p1, p2)) {
    const axisValue = (p1.y + p2.y) / 2
    return {
      trace,
      orientation: "horizontal",
      axisValue,
      start: Math.min(p1.x, p2.x),
      end: Math.max(p1.x, p2.x),
    }
  }

  return null
}

const mergeSegmentBucket = (segments: SegmentTrace[]) => {
  const sorted = [...segments].sort(
    (a, b) =>
      a.start - b.start ||
      a.end - b.end ||
      a.trace.mspPairId.localeCompare(b.trace.mspPairId),
  )

  const merged: SolvedTracePath[] = []
  let active = sorted[0]
  let activeMembers = active ? [active.trace] : []

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!
    if (!active) {
      active = current
      activeMembers = [current.trace]
      continue
    }

    if (current.start <= active.end + MERGE_GAP_EPSILON) {
      active = {
        ...active,
        end: Math.max(active.end, current.end),
      }
      activeMembers.push(current.trace)
      continue
    }

    merged.push(
      buildMergedTrace(
        active.orientation,
        active.axisValue,
        active.start,
        active.end,
        activeMembers,
      ),
    )

    active = current
    activeMembers = [current.trace]
  }

  if (active) {
    merged.push(
      buildMergedTrace(
        active.orientation,
        active.axisValue,
        active.start,
        active.end,
        activeMembers,
      ),
    )
  }

  return merged
}

export const mergeSameNetTraceLines = (
  traces: SolvedTracePath[],
): SolvedTracePath[] => {
  const tracesByNet = new Map<string, SolvedTracePath[]>()
  for (const trace of traces) {
    const netId = getTraceNetId(trace)
    if (!tracesByNet.has(netId)) tracesByNet.set(netId, [])
    tracesByNet.get(netId)!.push(trace)
  }

  const mergedOutput: SolvedTracePath[] = []

  for (const group of tracesByNet.values()) {
    const passthrough: SolvedTracePath[] = []
    const verticalBuckets = new Map<string, SegmentTrace[]>()
    const horizontalBuckets = new Map<string, SegmentTrace[]>()

    for (const trace of group) {
      const segmentTrace = getSegmentTrace(trace)
      if (!segmentTrace) {
        passthrough.push(trace)
        continue
      }

      const bucketKey = toAxisBucketKey(segmentTrace.axisValue)
      if (segmentTrace.orientation === "vertical") {
        if (!verticalBuckets.has(bucketKey)) verticalBuckets.set(bucketKey, [])
        verticalBuckets.get(bucketKey)!.push(segmentTrace)
      } else {
        if (!horizontalBuckets.has(bucketKey))
          horizontalBuckets.set(bucketKey, [])
        horizontalBuckets.get(bucketKey)!.push(segmentTrace)
      }
    }

    mergedOutput.push(...passthrough)

    for (const bucket of verticalBuckets.values()) {
      mergedOutput.push(...mergeSegmentBucket(bucket))
    }

    for (const bucket of horizontalBuckets.values()) {
      mergedOutput.push(...mergeSegmentBucket(bucket))
    }
  }

  return mergedOutput
}
