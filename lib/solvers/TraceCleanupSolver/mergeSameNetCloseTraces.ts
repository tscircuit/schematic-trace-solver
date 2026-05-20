import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const DEFAULT_CLOSE_THRESHOLD = 0.2
const EPSILON = 1e-9

type Endpoint = "start" | "end"

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

const areSamePoint = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON

const getEndpoint = (trace: SolvedTracePath, endpoint: Endpoint) =>
  endpoint === "start" ? trace.tracePath[0]! : trace.tracePath.at(-1)!

const orientPathWithEndpointAtEnd = (
  trace: SolvedTracePath,
  endpoint: Endpoint,
) =>
  endpoint === "start" ? [...trace.tracePath].reverse() : [...trace.tracePath]

const orientPathWithEndpointAtStart = (
  trace: SolvedTracePath,
  endpoint: Endpoint,
) =>
  endpoint === "end" ? [...trace.tracePath].reverse() : [...trace.tracePath]

const dedupeConsecutivePoints = (points: Point[]) => {
  const deduped: Point[] = []
  for (const point of points) {
    if (deduped.length === 0 || !areSamePoint(deduped.at(-1)!, point)) {
      deduped.push(point)
    }
  }
  return deduped
}

const mergeTracePair = (
  a: SolvedTracePath,
  b: SolvedTracePath,
  aEndpoint: Endpoint,
  bEndpoint: Endpoint,
): SolvedTracePath => {
  const aPath = orientPathWithEndpointAtEnd(a, aEndpoint)
  const bPath = orientPathWithEndpointAtStart(b, bEndpoint)
  const aJoin = aPath.at(-1)!
  const bJoin = bPath[0]!

  const joinPoint =
    Math.abs(aJoin.x - bJoin.x) <= Math.abs(aJoin.y - bJoin.y)
      ? { x: (aJoin.x + bJoin.x) / 2, y: aJoin.y }
      : { x: aJoin.x, y: (aJoin.y + bJoin.y) / 2 }

  const mergedPath = dedupeConsecutivePoints([
    ...aPath.slice(0, -1),
    joinPoint,
    ...bPath.slice(1),
  ])

  return {
    ...a,
    mspPairId: `${a.mspPairId}+${b.mspPairId}`,
    mspConnectionPairIds: [
      ...a.mspConnectionPairIds,
      ...b.mspConnectionPairIds,
    ],
    pinIds: [...new Set([...a.pinIds, ...b.pinIds])],
    tracePath: mergedPath,
  }
}

export const mergeSameNetCloseTraces = (
  traces: SolvedTracePath[],
  closeThreshold = DEFAULT_CLOSE_THRESHOLD,
): SolvedTracePath[] => {
  const remaining = [...traces]
  let mergedAny = true

  while (mergedAny) {
    mergedAny = false

    outer: for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const a = remaining[i]!
        const b = remaining[j]!

        if (a.globalConnNetId !== b.globalConnNetId) continue

        const candidates = [
          [
            "start",
            "start",
            distance(getEndpoint(a, "start"), getEndpoint(b, "start")),
          ],
          [
            "start",
            "end",
            distance(getEndpoint(a, "start"), getEndpoint(b, "end")),
          ],
          [
            "end",
            "start",
            distance(getEndpoint(a, "end"), getEndpoint(b, "start")),
          ],
          [
            "end",
            "end",
            distance(getEndpoint(a, "end"), getEndpoint(b, "end")),
          ],
        ] satisfies Array<[Endpoint, Endpoint, number]>

        candidates.sort((left, right) => left[2] - right[2])

        const [aEndpoint, bEndpoint, minDistance] = candidates[0]!
        if (minDistance > closeThreshold) continue

        const merged = mergeTracePair(a, b, aEndpoint, bEndpoint)
        remaining.splice(j, 1)
        remaining.splice(i, 1, merged)
        mergedAny = true
        break outer
      }
    }
  }

  return remaining
}
