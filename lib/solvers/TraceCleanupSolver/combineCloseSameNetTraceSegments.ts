import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

type Point = { x: number; y: number }

const DEFAULT_MAX_ENDPOINT_DISTANCE = 0.35
const EPS = 1e-6

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

const pointsEqual = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

const uniq = <T>(items: T[]) => Array.from(new Set(items))

const reversePath = (path: Point[]) => [...path].reverse()

const removeDuplicateNeighborPoints = (path: Point[]) => {
  const result: Point[] = []
  for (const point of path) {
    const previous = result[result.length - 1]
    if (!previous || !pointsEqual(previous, point)) {
      result.push(point)
    }
  }
  return result
}

const getEndpointVariants = (trace: SolvedTracePath) => {
  const path = trace.tracePath
  return [path, reversePath(path)]
}

const buildOrthogonalBridge = (from: Point, to: Point) => {
  if (pointsEqual(from, to)) return []
  if (Math.abs(from.x - to.x) < EPS || Math.abs(from.y - to.y) < EPS) {
    return [to]
  }
  return [{ x: to.x, y: from.y }, to]
}

const mergeTracePair = (
  traceA: SolvedTracePath,
  traceB: SolvedTracePath,
  maxEndpointDistance: number,
): SolvedTracePath | null => {
  let best: {
    distance: number
    pathA: Point[]
    pathB: Point[]
  } | null = null

  for (const variantA of getEndpointVariants(traceA)) {
    for (const variantB of getEndpointVariants(traceB)) {
      const endpointDistance = distance(
        variantA[variantA.length - 1]!,
        variantB[0]!,
      )
      if (
        endpointDistance <= maxEndpointDistance &&
        (!best || endpointDistance < best.distance)
      ) {
        best = {
          distance: endpointDistance,
          pathA: variantA,
          pathB: variantB,
        }
      }
    }
  }

  if (!best) return null

  const bridge = buildOrthogonalBridge(
    best.pathA[best.pathA.length - 1]!,
    best.pathB[0]!,
  )

  return {
    ...traceA,
    mspPairId: traceA.mspPairId,
    tracePath: removeDuplicateNeighborPoints([
      ...best.pathA,
      ...bridge,
      ...best.pathB,
    ]),
    mspConnectionPairIds: uniq([
      ...(traceA.mspConnectionPairIds ?? [traceA.mspPairId]),
      ...(traceB.mspConnectionPairIds ?? [traceB.mspPairId]),
    ]),
    pinIds: uniq([...(traceA.pinIds ?? []), ...(traceB.pinIds ?? [])]),
  }
}

export const combineCloseSameNetTraceSegments = (
  traces: SolvedTracePath[],
  params: { maxEndpointDistance?: number } = {},
): SolvedTracePath[] => {
  const maxEndpointDistance =
    params.maxEndpointDistance ?? DEFAULT_MAX_ENDPOINT_DISTANCE
  const remaining = [...traces]
  let didMerge = true

  while (didMerge) {
    didMerge = false

    outer: for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const traceA = remaining[i]!
        const traceB = remaining[j]!
        if (traceA.globalConnNetId !== traceB.globalConnNetId) continue

        const mergedTrace = mergeTracePair(traceA, traceB, maxEndpointDistance)
        if (!mergedTrace) continue

        remaining.splice(j, 1)
        remaining[i] = mergedTrace
        didMerge = true
        break outer
      }
    }
  }

  return remaining
}
