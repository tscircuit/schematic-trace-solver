import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const GEOM_EPS = 1e-6

function overlaps1D(
  a1: number,
  a2: number,
  b1: number,
  b2: number,
  minOverlap = GEOM_EPS,
): boolean {
  const minA = Math.min(a1, a2)
  const maxA = Math.max(a1, a2)
  const minB = Math.min(b1, b2)
  const maxB = Math.max(b1, b2)
  return Math.min(maxA, maxB) - Math.max(minA, minB) > minOverlap
}

export function snapSameNetTraces(
  traces: SolvedTracePath[],
  threshold = 0.05,
): SolvedTracePath[] {
  if (traces.length < 2) return traces

  const workingTraces = traces.map((t) => ({
...t,
    tracePath: t.tracePath.map((p) => ({...p })),
  }))

  for (let i = 0; i < workingTraces.length; i++) {
    const traceA = workingTraces[i]

    for (let j = i + 1; j < workingTraces.length; j++) {
      const traceB = workingTraces[j]

      if (traceA.net!== traceB.net) continue

      const pathA = simplifyPath(traceA.tracePath)
      const pathB = simplifyPath(traceB.tracePath)

      for (let ai = 0; ai < pathA.length - 1; ai++) {
        const segA = [pathA[ai], pathA[ai + 1]]

        for (let bi = 0; bi < pathB.length - 1; bi++) {
          const segB = [pathB[bi], pathB[bi + 1]]

          const isVertA = Math.abs(segA[0].x - segA[1].x) < GEOM_EPS
          const isVertB = Math.abs(segB[0].x - segB[1].x) < GEOM_EPS

          if (isVertA && isVertB) {
            const xDiff = Math.abs(segA[0].x - segB[0].x)
            if (
              xDiff < threshold &&
              xDiff > GEOM_EPS &&
              overlaps1D(segA[0].y, segA[1].y, segB[0].y, segB[1].y)
            ) {
              const meanX = (segA[0].x + segB[0].x) / 2
              pathA[ai].x = meanX
              pathA[ai + 1].x = meanX
              pathB[bi].x = meanX
              pathB[bi + 1].x = meanX
            }
          }

          const isHorizA = Math.abs(segA[0].y - segA[1].y) < GEOM_EPS
          const isHorizB = Math.abs(segB[0].y - segB[1].y) < GEOM_EPS

          if (isHorizA && isHorizB) {
            const yDiff = Math.abs(segA[0].y - segB[0].y)
            if (
              yDiff < threshold &&
              yDiff > GEOM_EPS &&
              overlaps1D(segA[0].x, segA[1].x, segB[0].x, segB[1].x)
            ) {
              const meanY = (segA[0].y + segB[0].y) / 2
              pathA[ai].y = meanY
              pathA[ai + 1].y = meanY
              pathB[bi].y = meanY
              pathB[bi + 1].y = meanY
            }
          }
        }
      }

      traceA.tracePath = pathA
      traceB.tracePath = pathB
    }
  }

  return workingTraces
}
