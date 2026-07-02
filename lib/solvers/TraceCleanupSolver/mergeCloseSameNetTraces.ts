import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { doesTraceOverlapWithExistingTraces } from "lib/utils/does-trace-overlap-with-existing-traces"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-9

type Endpoint = {
  traceIndex: number
  pointIndex: 0 | -1
  point: Point
}

const getTraceEndpoints = (
  trace: SolvedTracePath,
  traceIndex: number,
): Endpoint[] => [
  {
    traceIndex,
    pointIndex: 0,
    point: trace.tracePath[0]!,
  },
  {
    traceIndex,
    pointIndex: -1,
    point: trace.tracePath[trace.tracePath.length - 1]!,
  },
]

const sameX = (a: Point, b: Point) => Math.abs(a.x - b.x) < EPS
const sameY = (a: Point, b: Point) => Math.abs(a.y - b.y) < EPS
const manhattanDistance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

const orientTraceToEndpoint = (
  trace: SolvedTracePath,
  endpoint: Endpoint,
): Point[] =>
  endpoint.pointIndex === -1
    ? [...trace.tracePath]
    : [...trace.tracePath].reverse()

const buildMergedTrace = (
  firstTrace: SolvedTracePath,
  firstEndpoint: Endpoint,
  secondTrace: SolvedTracePath,
  secondEndpoint: Endpoint,
): SolvedTracePath => {
  const firstPath = orientTraceToEndpoint(firstTrace, firstEndpoint)
  const secondPath = orientTraceToEndpoint(
    secondTrace,
    secondEndpoint,
  ).reverse()
  const connectorEnd = secondPath[0]!

  return {
    ...firstTrace,
    mspPairId: `${firstTrace.mspPairId}+${secondTrace.mspPairId}`,
    mspConnectionPairIds: [
      ...new Set([
        ...(firstTrace.mspConnectionPairIds ?? [firstTrace.mspPairId]),
        ...(secondTrace.mspConnectionPairIds ?? [secondTrace.mspPairId]),
      ]),
    ],
    pinIds: [
      ...new Set([...(firstTrace.pinIds ?? []), ...(secondTrace.pinIds ?? [])]),
    ],
    tracePath: simplifyPath([
      ...firstPath,
      connectorEnd,
      ...secondPath.slice(1),
    ]),
  }
}

const getMergeCandidateKey = ({
  firstTrace,
  secondTrace,
  firstEndpoint,
  secondEndpoint,
}: {
  firstTrace: SolvedTracePath
  secondTrace: SolvedTracePath
  firstEndpoint: Endpoint
  secondEndpoint: Endpoint
}) =>
  [
    firstTrace.mspPairId,
    firstEndpoint.pointIndex,
    secondTrace.mspPairId,
    secondEndpoint.pointIndex,
  ].join("::")

const findMergeCandidate = (
  traces: SolvedTracePath[],
  maxMergeDistance: number,
  blockedMergeCandidates: Set<string>,
):
  | {
      firstIndex: number
      secondIndex: number
      firstEndpoint: Endpoint
      secondEndpoint: Endpoint
      distance: number
    }
  | undefined => {
  let bestCandidate:
    | {
        firstIndex: number
        secondIndex: number
        firstEndpoint: Endpoint
        secondEndpoint: Endpoint
        distance: number
      }
    | undefined

  for (let firstIndex = 0; firstIndex < traces.length; firstIndex++) {
    const firstTrace = traces[firstIndex]!
    if (firstTrace.tracePath.length < 2) continue

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < traces.length;
      secondIndex++
    ) {
      const secondTrace = traces[secondIndex]!
      if (secondTrace.tracePath.length < 2) continue
      if (firstTrace.globalConnNetId !== secondTrace.globalConnNetId) continue

      for (const firstEndpoint of getTraceEndpoints(firstTrace, firstIndex)) {
        for (const secondEndpoint of getTraceEndpoints(
          secondTrace,
          secondIndex,
        )) {
          if (
            !sameX(firstEndpoint.point, secondEndpoint.point) &&
            !sameY(firstEndpoint.point, secondEndpoint.point)
          ) {
            continue
          }

          const distance = manhattanDistance(
            firstEndpoint.point,
            secondEndpoint.point,
          )
          if (distance > maxMergeDistance) continue
          if (bestCandidate && distance >= bestCandidate.distance) continue
          if (
            blockedMergeCandidates.has(
              getMergeCandidateKey({
                firstTrace,
                secondTrace,
                firstEndpoint,
                secondEndpoint,
              }),
            )
          ) {
            continue
          }

          bestCandidate = {
            firstIndex,
            secondIndex,
            firstEndpoint,
            secondEndpoint,
            distance,
          }
        }
      }
    }
  }

  return bestCandidate
}

export const mergeCloseSameNetTraces = ({
  traces,
  maxMergeDistance,
}: {
  traces: SolvedTracePath[]
  maxMergeDistance: number
}): SolvedTracePath[] => {
  const outputTraces = [...traces]
  const blockedMergeCandidates = new Set<string>()

  while (true) {
    const candidate = findMergeCandidate(
      outputTraces,
      maxMergeDistance,
      blockedMergeCandidates,
    )
    if (!candidate) break

    const firstTrace = outputTraces[candidate.firstIndex]!
    const secondTrace = outputTraces[candidate.secondIndex]!
    const mergedTrace = buildMergedTrace(
      firstTrace,
      candidate.firstEndpoint,
      secondTrace,
      candidate.secondEndpoint,
    )

    const otherNetTraces = outputTraces.filter(
      (trace, index) =>
        index !== candidate.firstIndex &&
        index !== candidate.secondIndex &&
        trace.globalConnNetId !== mergedTrace.globalConnNetId,
    )

    if (
      doesTraceOverlapWithExistingTraces(mergedTrace.tracePath, otherNetTraces)
    ) {
      blockedMergeCandidates.add(
        getMergeCandidateKey({
          firstTrace,
          secondTrace,
          firstEndpoint: candidate.firstEndpoint,
          secondEndpoint: candidate.secondEndpoint,
        }),
      )
      continue
    }

    outputTraces.splice(candidate.secondIndex, 1)
    outputTraces[candidate.firstIndex] = mergedTrace
  }

  return outputTraces
}
