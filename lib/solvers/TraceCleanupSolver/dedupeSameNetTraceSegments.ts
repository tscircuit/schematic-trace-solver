import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const COORD_PRECISION = 6

const pointKey = (point: { x: number; y: number }) =>
  `${point.x.toFixed(COORD_PRECISION)},${point.y.toFixed(COORD_PRECISION)}`

const segmentKey = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
) => {
  const endpoints = [pointKey(p1), pointKey(p2)].sort()
  return `${endpoints[0]}|${endpoints[1]}`
}

const getTraceSegments = (trace: SolvedTracePath) => {
  const segments: string[] = []
  for (let i = 0; i < trace.tracePath.length - 1; i++) {
    segments.push(segmentKey(trace.tracePath[i]!, trace.tracePath[i + 1]!))
  }
  return segments
}

const getContiguousKeptPath = (
  trace: SolvedTracePath,
  keepSegment: boolean[],
) => {
  const keptIndexes = keepSegment
    .map((keep, index) => (keep ? index : -1))
    .filter((index) => index !== -1)

  if (keptIndexes.length === 0) return []

  for (let i = 1; i < keptIndexes.length; i++) {
    if (keptIndexes[i] !== keptIndexes[i - 1]! + 1) {
      return trace.tracePath
    }
  }

  const firstSegmentIndex = keptIndexes[0]!
  const lastSegmentIndex = keptIndexes[keptIndexes.length - 1]!

  return trace.tracePath.slice(firstSegmentIndex, lastSegmentIndex + 2)
}

export const dedupeSameNetTraceSegments = (
  traces: SolvedTracePath[],
): SolvedTracePath[] => {
  const seenByNet = new Map<string, Set<string>>()
  const output: SolvedTracePath[] = []

  for (const trace of traces) {
    const netId = trace.globalConnNetId ?? trace.dcConnNetId ?? ""
    const seenSegments = seenByNet.get(netId) ?? new Set<string>()
    seenByNet.set(netId, seenSegments)

    const segments = getTraceSegments(trace)
    const keepSegment = segments.map((segment) => !seenSegments.has(segment))
    const dedupedPath = getContiguousKeptPath(trace, keepSegment)

    for (const segment of segments) {
      seenSegments.add(segment)
    }

    if (dedupedPath.length < 2) continue

    output.push(
      dedupedPath === trace.tracePath
        ? trace
        : {
            ...trace,
            tracePath: dedupedPath,
          },
    )
  }

  return output
}
