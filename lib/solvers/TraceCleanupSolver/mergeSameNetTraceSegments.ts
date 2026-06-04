import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const DEFAULT_MERGE_TOLERANCE = 0.1

type EndpointRef = {
  point: Point
  side: "start" | "end"
}

const distance = (a: Point, b: Point) =>
  Math.hypot(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

const sameAxisBridge = (
  a: Point,
  b: Point,
  tolerance: number,
): Point[] | null => {
  if (Math.abs(a.y - b.y) <= tolerance) {
    const y = (a.y + b.y) / 2
    return [
      { x: a.x, y },
      { x: b.x, y },
    ]
  }

  if (Math.abs(a.x - b.x) <= tolerance) {
    const x = (a.x + b.x) / 2
    return [
      { x, y: a.y },
      { x, y: b.y },
    ]
  }

  return null
}

const endpointsForTrace = (trace: SolvedTracePath): EndpointRef[] => [
  { point: trace.tracePath[0]!, side: "start" },
  { point: trace.tracePath[trace.tracePath.length - 1]!, side: "end" },
]

const orientPathToEndpoint = (
  tracePath: Point[],
  endpoint: EndpointRef,
  position: "left" | "right",
) => {
  const path =
    (position === "left" && endpoint.side === "end") ||
    (position === "right" && endpoint.side === "start")
      ? tracePath
      : [...tracePath].reverse()

  return path.map((point) => ({ ...point }))
}

const tryMergePair = (
  a: SolvedTracePath,
  b: SolvedTracePath,
  tolerance: number,
): SolvedTracePath | null => {
  if (a.globalConnNetId !== b.globalConnNetId) return null

  let best:
    | {
        aEndpoint: EndpointRef
        bEndpoint: EndpointRef
        bridge: Point[]
        distance: number
      }
    | null = null

  for (const aEndpoint of endpointsForTrace(a)) {
    for (const bEndpoint of endpointsForTrace(b)) {
      const bridge = sameAxisBridge(aEndpoint.point, bEndpoint.point, tolerance)
      if (!bridge) continue

      const endpointDistance = distance(aEndpoint.point, bEndpoint.point)
      if (endpointDistance > tolerance) continue

      if (!best || endpointDistance < best.distance) {
        best = { aEndpoint, bEndpoint, bridge, distance: endpointDistance }
      }
    }
  }

  if (!best) return null

  const leftPath = orientPathToEndpoint(a.tracePath, best.aEndpoint, "left")
  const rightPath = orientPathToEndpoint(b.tracePath, best.bEndpoint, "right")
  const mergedPath = simplifyPath([
    ...leftPath.slice(0, -1),
    ...best.bridge,
    ...rightPath.slice(1),
  ])

  return {
    ...a,
    mspPairId: `${a.mspPairId}+${b.mspPairId}`,
    tracePath: mergedPath,
    mspConnectionPairIds: [
      ...a.mspConnectionPairIds,
      ...b.mspConnectionPairIds,
    ],
    pinIds: [...a.pinIds, ...b.pinIds],
  }
}

export const mergeSameNetTraceSegments = (
  traces: SolvedTracePath[],
  tolerance = DEFAULT_MERGE_TOLERANCE,
): SolvedTracePath[] => {
  const pending = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  let didMerge = true
  while (didMerge) {
    didMerge = false

    outer: for (let i = 0; i < pending.length; i++) {
      for (let j = i + 1; j < pending.length; j++) {
        const merged = tryMergePair(pending[i]!, pending[j]!, tolerance)
        if (!merged) continue

        pending.splice(j, 1)
        pending[i] = merged
        didMerge = true
        break outer
      }
    }
  }

  return pending
}
