import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-9

interface HSegment {
  ti: number
  si: number
  y: number
  xMin: number
  xMax: number
}

interface VSegment {
  ti: number
  si: number
  x: number
  yMin: number
  yMax: number
}

/**
 * Merges same-net trace segments that run parallel and close together so they
 * end up at exactly the same Y (for horizontals) or X (for verticals).
 *
 * Only interior segments (those whose endpoints aren't pin endpoints) are
 * snapped, so pin connectivity is preserved. Adjacent segments in an
 * orthogonal trace are perpendicular, so changing one endpoint's coordinate
 * just adjusts the length of the perpendicular neighbor without breaking
 * orthogonality.
 */
export const mergeCloseParallelSegments = (
  traces: SolvedTracePath[],
  opts: { mergeThreshold?: number } = {},
): SolvedTracePath[] => {
  const mergeThreshold = opts.mergeThreshold ?? 0.4

  const newTraces = traces.map((t) => ({
    ...t,
    tracePath: t.tracePath.map((p) => ({ ...p })),
  }))

  const netGroups = new Map<string, number[]>()
  for (let i = 0; i < newTraces.length; i++) {
    const netId = newTraces[i]!.globalConnNetId
    if (!netGroups.has(netId)) netGroups.set(netId, [])
    netGroups.get(netId)!.push(i)
  }

  const isInteriorSegment = (path: Point[], si: number) =>
    si > 0 && si < path.length - 2

  for (const [, traceIndices] of netGroups) {
    const hSegs: HSegment[] = []
    const vSegs: VSegment[] = []

    for (const ti of traceIndices) {
      const path = newTraces[ti]!.tracePath
      for (let si = 0; si < path.length - 1; si++) {
        if (!isInteriorSegment(path, si)) continue
        const p1 = path[si]!
        const p2 = path[si + 1]!
        if (Math.abs(p1.y - p2.y) < EPS && Math.abs(p1.x - p2.x) > EPS) {
          hSegs.push({
            ti,
            si,
            y: p1.y,
            xMin: Math.min(p1.x, p2.x),
            xMax: Math.max(p1.x, p2.x),
          })
        } else if (
          Math.abs(p1.x - p2.x) < EPS &&
          Math.abs(p1.y - p2.y) > EPS
        ) {
          vSegs.push({
            ti,
            si,
            x: p1.x,
            yMin: Math.min(p1.y, p2.y),
            yMax: Math.max(p1.y, p2.y),
          })
        }
      }
    }

    snapHorizontalClusters(newTraces, hSegs, mergeThreshold)
    snapVerticalClusters(newTraces, vSegs, mergeThreshold)
  }

  return newTraces.map((t) => ({
    ...t,
    tracePath: simplifyPath(t.tracePath),
  }))
}

const snapHorizontalClusters = (
  traces: SolvedTracePath[],
  segs: HSegment[],
  threshold: number,
) => {
  const used = new Set<number>()
  for (let i = 0; i < segs.length; i++) {
    if (used.has(i)) continue
    const cluster: number[] = [i]
    const seed = segs[i]!
    for (let j = i + 1; j < segs.length; j++) {
      if (used.has(j)) continue
      const cand = segs[j]!
      if (Math.abs(cand.y - seed.y) > threshold) continue
      const overlap =
        Math.min(seed.xMax, cand.xMax) - Math.max(seed.xMin, cand.xMin)
      if (overlap <= EPS) continue
      cluster.push(j)
    }
    if (cluster.length < 2) continue
    const avgY =
      cluster.reduce((sum, idx) => sum + segs[idx]!.y, 0) / cluster.length
    for (const idx of cluster) {
      const seg = segs[idx]!
      const path = traces[seg.ti]!.tracePath
      path[seg.si]!.y = avgY
      path[seg.si + 1]!.y = avgY
      used.add(idx)
    }
  }
}

const snapVerticalClusters = (
  traces: SolvedTracePath[],
  segs: VSegment[],
  threshold: number,
) => {
  const used = new Set<number>()
  for (let i = 0; i < segs.length; i++) {
    if (used.has(i)) continue
    const cluster: number[] = [i]
    const seed = segs[i]!
    for (let j = i + 1; j < segs.length; j++) {
      if (used.has(j)) continue
      const cand = segs[j]!
      if (Math.abs(cand.x - seed.x) > threshold) continue
      const overlap =
        Math.min(seed.yMax, cand.yMax) - Math.max(seed.yMin, cand.yMin)
      if (overlap <= EPS) continue
      cluster.push(j)
    }
    if (cluster.length < 2) continue
    const avgX =
      cluster.reduce((sum, idx) => sum + segs[idx]!.x, 0) / cluster.length
    for (const idx of cluster) {
      const seg = segs[idx]!
      const path = traces[seg.ti]!.tracePath
      path[seg.si]!.x = avgX
      path[seg.si + 1]!.x = avgX
      used.add(idx)
    }
  }
}
