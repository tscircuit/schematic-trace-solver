import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const pointKey = (point: Point) => `${point.x},${point.y}`

export const getSameNetTraceSegmentKey = (
  globalConnNetId: string,
  a: Point,
  b: Point,
) => {
  const aKey = pointKey(a)
  const bKey = pointKey(b)
  const segmentKey = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`
  return `${globalConnNetId}:${segmentKey}`
}

export const dedupeSameNetTraceSegments = (
  traces: SolvedTracePath[],
): SolvedTracePath[] => {
  const seenSegmentKeys = new Set<string>()

  return traces.map((trace) => {
    let tracePath = trace.tracePath

    while (tracePath.length > 1) {
      const firstSegmentKey = getSameNetTraceSegmentKey(
        trace.globalConnNetId,
        tracePath[0]!,
        tracePath[1]!,
      )
      if (!seenSegmentKeys.has(firstSegmentKey)) break
      tracePath = tracePath.slice(1)
    }

    while (tracePath.length > 1) {
      const lastPointIndex = tracePath.length - 1
      const lastSegmentKey = getSameNetTraceSegmentKey(
        trace.globalConnNetId,
        tracePath[lastPointIndex - 1]!,
        tracePath[lastPointIndex]!,
      )
      if (!seenSegmentKeys.has(lastSegmentKey)) break
      tracePath = tracePath.slice(0, -1)
    }

    for (let i = 0; i < tracePath.length - 1; i++) {
      seenSegmentKeys.add(
        getSameNetTraceSegmentKey(
          trace.globalConnNetId,
          tracePath[i]!,
          tracePath[i + 1]!,
        ),
      )
    }

    return tracePath === trace.tracePath ? trace : { ...trace, tracePath }
  })
}
