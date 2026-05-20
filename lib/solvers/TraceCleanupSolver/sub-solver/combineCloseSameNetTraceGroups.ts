import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { findCloseSameNetTraceGroups } from "./findCloseSameNetTraceGroups"

const pointsEqual = (a: Point, b: Point) => a.x === b.x && a.y === b.y

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

const getEndpointJoin = (left: SolvedTracePath, right: SolvedTracePath) => {
  const leftStart = left.tracePath[0]
  const leftEnd = left.tracePath[left.tracePath.length - 1]
  const rightStart = right.tracePath[0]
  const rightEnd = right.tracePath[right.tracePath.length - 1]

  const candidates = [
    {
      distance: distance(leftEnd, rightStart),
      path: [...left.tracePath, ...right.tracePath],
    },
    {
      distance: distance(leftEnd, rightEnd),
      path: [...left.tracePath, ...right.tracePath.toReversed()],
    },
    {
      distance: distance(leftStart, rightEnd),
      path: [...right.tracePath, ...left.tracePath],
    },
    {
      distance: distance(leftStart, rightStart),
      path: [...left.tracePath.toReversed(), ...right.tracePath],
    },
  ]

  return candidates.sort((a, b) => a.distance - b.distance)[0]
}

const dedupeConsecutivePoints = (points: Point[]) => {
  const deduped: Point[] = []
  for (const point of points) {
    const previous = deduped[deduped.length - 1]
    if (!previous || !pointsEqual(previous, point)) {
      deduped.push(point)
    }
  }
  return deduped
}

/**
 * Combines close same-net trace segments into a single solved trace path.
 *
 * The join is intentionally conservative: it only joins the closest endpoint
 * pair already discovered by `findCloseSameNetTraceGroups`, then carries over
 * all source connection-pair ids and pin ids so downstream consumers still know
 * which original connections are represented by the merged path.
 */
export const combineCloseSameNetTraceGroups = (
  traces: SolvedTracePath[],
  maxEndpointDistance = 0.5,
): SolvedTracePath[] => {
  const tracesMap = new Map(traces.map((trace) => [trace.mspPairId, trace]))
  const consumedTraceIds = new Set<string>()

  for (const group of findCloseSameNetTraceGroups(
    traces,
    maxEndpointDistance,
  )) {
    const [leftId, rightId] = group.traceIds
    if (consumedTraceIds.has(leftId) || consumedTraceIds.has(rightId)) continue

    const left = tracesMap.get(leftId)
    const right = tracesMap.get(rightId)
    if (!left || !right) continue

    const endpointJoin = getEndpointJoin(left, right)
    if (endpointJoin.distance > maxEndpointDistance) continue

    tracesMap.set(leftId, {
      ...left,
      tracePath: dedupeConsecutivePoints(endpointJoin.path),
      mspConnectionPairIds: [
        ...left.mspConnectionPairIds,
        ...right.mspConnectionPairIds,
      ],
      pinIds: [...left.pinIds, ...right.pinIds],
    })
    tracesMap.delete(rightId)
    consumedTraceIds.add(leftId)
    consumedTraceIds.add(rightId)
  }

  return [...tracesMap.values()]
}
