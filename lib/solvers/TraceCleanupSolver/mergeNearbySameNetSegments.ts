import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { ConnectivityMap } from "connectivity-map"

const EPS = 1e-4
const DEFAULT_MERGE_DISTANCE = 0.06

const isHorizontal = (a: Point, b: Point) => Math.abs(a.y - b.y) < EPS
const isVertical = (a: Point, b: Point) => Math.abs(a.x - b.x) < EPS

const rangesOverlap = (a1: number, a2: number, b1: number, b2: number) => {
  const minA = Math.min(a1, a2)
  const maxA = Math.max(a1, a2)
  const minB = Math.min(b1, b2)
  const maxB = Math.max(b1, b2)
  return Math.max(minA, minB) <= Math.min(maxA, maxB) + EPS
}

const areSameNet = (
  traceA: SolvedTracePath,
  traceB: SolvedTracePath,
  connMap: ConnectivityMap,
) => {
  if (traceA.mspPairId === traceB.mspPairId) return true
  return connMap.areIdsConnected(traceA.mspPairId, traceB.mspPairId)
}

export const mergeNearbySameNetSegments = ({
  traces,
  connMap,
  maxMergeDistance = DEFAULT_MERGE_DISTANCE,
}: {
  traces: Map<string, SolvedTracePath>
  connMap: ConnectivityMap
  maxMergeDistance?: number
}): Map<string, SolvedTracePath> => {
  const updated = new Map<string, SolvedTracePath>()
  for (const [id, trace] of traces.entries()) {
    updated.set(id, {
      ...trace,
      tracePath: trace.tracePath.map((pt) => ({ ...pt })),
    })
  }

  const entries = Array.from(updated.values())
  for (let i = 0; i < entries.length; i++) {
    const traceA = entries[i]!
    const ptsA = traceA.tracePath
    for (let j = i + 1; j < entries.length; j++) {
      const traceB = entries[j]!
      if (!areSameNet(traceA, traceB, connMap)) continue
      const ptsB = traceB.tracePath

      for (let sa = 1; sa < ptsA.length - 2; sa++) {
        const a1 = ptsA[sa]!
        const a2 = ptsA[sa + 1]!
        for (let sb = 1; sb < ptsB.length - 2; sb++) {
          const b1 = ptsB[sb]!
          const b2 = ptsB[sb + 1]!

          if (
            isHorizontal(a1, a2) &&
            isHorizontal(b1, b2) &&
            isVertical(ptsB[sb - 1]!, b1) &&
            isVertical(b2, ptsB[sb + 2]!)
          ) {
            const dy = Math.abs(a1.y - b1.y)
            if (
              dy > EPS &&
              dy <= maxMergeDistance &&
              rangesOverlap(a1.x, a2.x, b1.x, b2.x)
            ) {
              b1.y = a1.y
              b2.y = a1.y
            }
          } else if (
            isVertical(a1, a2) &&
            isVertical(b1, b2) &&
            isHorizontal(ptsB[sb - 1]!, b1) &&
            isHorizontal(b2, ptsB[sb + 2]!)
          ) {
            const dx = Math.abs(a1.x - b1.x)
            if (
              dx > EPS &&
              dx <= maxMergeDistance &&
              rangesOverlap(a1.y, a2.y, b1.y, b2.y)
            ) {
              b1.x = a1.x
              b2.x = a1.x
            }
          }
        }
      }
    }
  }

  return updated
}
