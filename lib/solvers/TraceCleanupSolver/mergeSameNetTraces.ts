import { simplifyTracePath } from "lib/utils/simplifyTracePath"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
} from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

const EPS = 0.01

export const mergeSameNetTraces = (
  traces: SolvedTracePath[],
): SolvedTracePath[] => {
  if (traces.length === 0) return []
  let currentTraces = structuredClone(traces)

  // 1. Snapping Phase: Align segments that are very close
  const netIds = Array.from(
    new Set(currentTraces.map((t) => t.globalConnNetId)),
  )

  for (const netId of netIds) {
    const netTraces = currentTraces.filter((t) => t.globalConnNetId === netId)
    if (netTraces.length < 2) continue

    const horzSegments: Array<{ p1: any; p2: any; traceIndex: number }> = []
    const vertSegments: Array<{ p1: any; p2: any; traceIndex: number }> = []

    for (let t = 0; t < netTraces.length; t++) {
      const trace = netTraces[t]
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        const p1 = trace.tracePath[i]
        const p2 = trace.tracePath[i + 1]
        if (isHorizontal(p1, p2)) {
          horzSegments.push({ p1, p2, traceIndex: t })
        } else if (isVertical(p1, p2)) {
          vertSegments.push({ p1, p2, traceIndex: t })
        }
      }
    }

    // Snap horizontal
    for (let i = 0; i < horzSegments.length; i++) {
      const s1 = horzSegments[i]
      const y1 = s1.p1.y
      for (let j = i + 1; j < horzSegments.length; j++) {
        const s2 = horzSegments[j]
        if (s1.traceIndex === s2.traceIndex) continue
        if (Math.abs(y1 - s2.p1.y) < EPS && Math.abs(y1 - s2.p1.y) > 1e-9) {
          s2.p1.y = y1
          s2.p2.y = y1
        }
      }
    }

    // Snap vertical
    for (let i = 0; i < vertSegments.length; i++) {
      const s1 = vertSegments[i]
      const x1 = s1.p1.x
      for (let j = i + 1; j < vertSegments.length; j++) {
        const s2 = vertSegments[j]
        if (s1.traceIndex === s2.traceIndex) continue
        if (Math.abs(x1 - s2.p1.x) < EPS && Math.abs(x1 - s2.p1.x) > 1e-9) {
          s2.p1.x = x1
          s2.p2.x = x1
        }
      }
    }
  }

  // 2. Merging Phase: Combine traces that share endpoints and are collinear
  const finalTraces: SolvedTracePath[] = []

  for (const netId of netIds) {
    let netTraces = currentTraces.filter((t) => t.globalConnNetId === netId)

    let mergedAny = true
    while (mergedAny) {
      mergedAny = false

      for (let i = 0; i < netTraces.length; i++) {
        for (let j = i + 1; j < netTraces.length; j++) {
          const t1 = netTraces[i]
          const t2 = netTraces[j]

          const p1_start = t1.tracePath[0]
          const p1_end = t1.tracePath[t1.tracePath.length - 1]
          const p2_start = t2.tracePath[0]
          const p2_end = t2.tracePath[t2.tracePath.length - 1]

          let mergedPath: any[] | null = null

          if (dist(p1_end, p2_start) < EPS) {
            if (
              isCollinear(
                t1.tracePath[t1.tracePath.length - 2],
                p1_end,
                t2.tracePath[1],
              )
            ) {
              mergedPath = [...t1.tracePath, ...t2.tracePath.slice(1)]
            }
          } else if (dist(p1_end, p2_end) < EPS) {
            if (
              isCollinear(
                t1.tracePath[t1.tracePath.length - 2],
                p1_end,
                t2.tracePath[t2.tracePath.length - 2],
              )
            ) {
              mergedPath = [
                ...t1.tracePath,
                ...t2.tracePath.slice(0, -1).reverse(),
              ]
            }
          } else if (dist(p1_start, p2_start) < EPS) {
            if (isCollinear(t1.tracePath[1], p1_start, t2.tracePath[1])) {
              mergedPath = [...t1.tracePath.slice(1).reverse(), ...t2.tracePath]
            }
          } else if (dist(p1_start, p2_end) < EPS) {
            if (
              isCollinear(
                t1.tracePath[1],
                p1_start,
                t2.tracePath[t2.tracePath.length - 2],
              )
            ) {
              mergedPath = [...t2.tracePath, ...t1.tracePath.slice(1)]
            }
          }

          if (mergedPath) {
            netTraces[i] = {
              ...t1,
              tracePath: simplifyTracePath(mergedPath),
              mspPairId:
                t1.mspPairId === t2.mspPairId
                  ? t1.mspPairId
                  : `${t1.mspPairId}_${t2.mspPairId}`,
            }
            netTraces.splice(j, 1)
            mergedAny = true
            break
          }
        }
        if (mergedAny) break
      }
    }
    finalTraces.push(...netTraces)
  }

  return finalTraces
}

const dist = (p1: any, p2: any) =>
  Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)

const isCollinear = (p1: any, p2: any, p3: any) => {
  if (!p1 || !p2 || !p3) return false
  const dx1 = p2.x - p1.x
  const dy1 = p2.y - p1.y
  const dx2 = p3.x - p2.x
  const dy2 = p3.y - p2.y

  const EPS_COLL = 1e-6
  if (Math.abs(dx1) < EPS_COLL && Math.abs(dx2) < EPS_COLL) return true
  if (Math.abs(dy1) < EPS_COLL && Math.abs(dy2) < EPS_COLL) return true

  return false
}
