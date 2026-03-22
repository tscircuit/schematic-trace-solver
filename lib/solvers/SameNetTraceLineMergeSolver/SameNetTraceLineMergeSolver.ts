import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"

type HorzSeg = {
  mspPairId: MspConnectionPairId
  segIdx: number
  start: number
  end: number
  canonY: number
  bucket: number
}

type VertSeg = {
  mspPairId: MspConnectionPairId
  segIdx: number
  start: number
  end: number
  canonX: number
  bucket: number
}

function bucketCoord(canon: number, tolerance: number): number {
  return Math.round(canon / tolerance) * tolerance
}

/** Merge bucket keys that are within `tolerance` so near-Y segments (e.g. 1.0 vs 1.005) share one pass. */
function clusterSortedBuckets(
  sortedUnique: number[],
  tolerance: number,
): number[][] {
  if (sortedUnique.length === 0) return []
  const clusters: number[][] = []
  let cur = [sortedUnique[0]!]
  for (let i = 1; i < sortedUnique.length; i++) {
    const b = sortedUnique[i]!
    if (b - cur[cur.length - 1]! <= tolerance) {
      cur.push(b)
    } else {
      clusters.push(cur)
      cur = [b]
    }
  }
  clusters.push(cur)
  return clusters
}

function deepCloneTraceMap(
  map: Record<MspConnectionPairId, SolvedTracePath>,
): Record<MspConnectionPairId, SolvedTracePath> {
  const out: Record<MspConnectionPairId, SolvedTracePath> = {}
  for (const id of Object.keys(map)) {
    const t = map[id]!
    out[id] = {
      ...t,
      pins: structuredClone(t.pins),
      tracePath: t.tracePath.map((p) => ({ x: p.x, y: p.y })),
      mspConnectionPairIds: [...t.mspConnectionPairIds],
      pinIds: [...t.pinIds],
    }
  }
  return out
}

function classifyHorizontal(
  p0: Point,
  p1: Point,
  tolerance: number,
): { canonY: number } | null {
  const dy = Math.abs(p0.y - p1.y)
  const dx = Math.abs(p0.x - p1.x)
  if (dy < tolerance && dx < tolerance) return null
  if (dy < tolerance) {
    return { canonY: (p0.y + p1.y) / 2 }
  }
  return null
}

function classifyVertical(
  p0: Point,
  p1: Point,
  tolerance: number,
): { canonX: number } | null {
  const dy = Math.abs(p0.y - p1.y)
  const dx = Math.abs(p0.x - p1.x)
  if (dy < tolerance && dx < tolerance) return null
  if (dx < tolerance) {
    return { canonX: (p0.x + p1.x) / 2 }
  }
  return null
}

function orderHorizontalEndpoints(
  prev: Point | null,
  next: Point | null,
  xmin: number,
  xmax: number,
  y: number,
): [Point, Point] {
  const a: Point = { x: xmin, y }
  const b: Point = { x: xmax, y }
  if (!prev && !next) return [a, b]
  const dist = (p: Point, q: Point) =>
    (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y)
  if (prev && !next) {
    return dist(prev, a) <= dist(prev, b) ? [a, b] : [b, a]
  }
  if (!prev && next) {
    return dist(a, next) <= dist(b, next) ? [a, b] : [b, a]
  }
  const s1 = dist(prev!, a) + dist(b, next!)
  const s2 = dist(prev!, b) + dist(a, next!)
  return s1 <= s2 ? [a, b] : [b, a]
}

function orderVerticalEndpoints(
  prev: Point | null,
  next: Point | null,
  ymin: number,
  ymax: number,
  x: number,
): [Point, Point] {
  const a: Point = { x, y: ymin }
  const b: Point = { x, y: ymax }
  if (!prev && !next) return [a, b]
  const dist = (p: Point, q: Point) =>
    (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y)
  if (prev && !next) {
    return dist(prev, a) <= dist(prev, b) ? [a, b] : [b, a]
  }
  if (!prev && next) {
    return dist(a, next) <= dist(b, next) ? [a, b] : [b, a]
  }
  const s1 = dist(prev!, a) + dist(b, next!)
  const s2 = dist(prev!, b) + dist(a, next!)
  return s1 <= s2 ? [a, b] : [b, a]
}

function spliceSegmentChain(
  pts: Point[],
  segFirst: number,
  segLast: number,
  pStart: Point,
  pEnd: Point,
): Point[] {
  const before = pts.slice(0, segFirst)
  const after = pts.slice(segLast + 2)
  return [...before, pStart, pEnd, ...after]
}

type HMergeOp = {
  mspPairId: MspConnectionPairId
  segFirst: number
  segLast: number
  x0: number
  x1: number
  y: number
}

type VMergeOp = {
  mspPairId: MspConnectionPairId
  segFirst: number
  segLast: number
  y0: number
  y1: number
  x: number
}

function collectHorizontalMergeOps(
  traces: Record<MspConnectionPairId, SolvedTracePath>,
  tolerance: number,
): HMergeOp[] {
  const byNet = new Map<string, HorzSeg[]>()
  for (const mspPairId of Object.keys(traces)) {
    const path = traces[mspPairId]!.tracePath
    const net = traces[mspPairId]!.globalConnNetId
    for (let i = 0; i < path.length - 1; i++) {
      const p0 = path[i]!
      const p1 = path[i + 1]!
      const h = classifyHorizontal(p0, p1, tolerance)
      if (!h) continue
      const bucket = bucketCoord(h.canonY, tolerance)
      const start = Math.min(p0.x, p1.x)
      const end = Math.max(p0.x, p1.x)
      const seg: HorzSeg = {
        mspPairId,
        segIdx: i,
        start,
        end,
        canonY: h.canonY,
        bucket,
      }
      const list = byNet.get(net) ?? []
      list.push(seg)
      byNet.set(net, list)
    }
  }

  const ops: HMergeOp[] = []
  for (const segs of byNet.values()) {
    const uniqueBuckets = [...new Set(segs.map((s) => s.bucket))].sort(
      (a, b) => a - b,
    )
    const bucketClusters = clusterSortedBuckets(uniqueBuckets, tolerance)
    const bucketToCluster = new Map<number, number>()
    for (let ci = 0; ci < bucketClusters.length; ci++) {
      for (const bk of bucketClusters[ci]!) {
        bucketToCluster.set(bk, ci)
      }
    }
    for (let ci = 0; ci < bucketClusters.length; ci++) {
      const clusterSegs = segs.filter(
        (s) => bucketToCluster.get(s.bucket) === ci,
      )
      clusterSegs.sort((a, b) => a.start - b.start)
      let i = 0
      while (i < clusterSegs.length) {
        let curEnd = clusterSegs[i]!.end
        const group: HorzSeg[] = [clusterSegs[i]!]
        let j = i + 1
        while (
          j < clusterSegs.length &&
          curEnd >= clusterSegs[j]!.start - tolerance
        ) {
          curEnd = Math.max(curEnd, clusterSegs[j]!.end)
          group.push(clusterSegs[j]!)
          j++
        }
        if (group.length > 1) {
          const x0 = Math.min(...group.map((g) => g.start))
          const x1 = Math.max(...group.map((g) => g.end))
          let sumY = 0
          let c = 0
          for (const g of group) {
            const pts = traces[g.mspPairId]!.tracePath
            const a = pts[g.segIdx]!
            const b = pts[g.segIdx + 1]!
            sumY += a.y + b.y
            c += 2
          }
          const y = sumY / c
          const byPath = new Map<MspConnectionPairId, number[]>()
          for (const g of group) {
            const arr = byPath.get(g.mspPairId) ?? []
            arr.push(g.segIdx)
            byPath.set(g.mspPairId, arr)
          }
          for (const [msp, idxs] of byPath) {
            idxs.sort((a, b) => a - b)
            const chains: number[][] = []
            let chain = [idxs[0]!]
            for (let k = 1; k < idxs.length; k++) {
              if (idxs[k] === idxs[k - 1]! + 1) {
                chain.push(idxs[k]!)
              } else {
                chains.push(chain)
                chain = [idxs[k]!]
              }
            }
            chains.push(chain)
            for (const ch of chains) {
              ops.push({
                mspPairId: msp,
                segFirst: ch[0]!,
                segLast: ch[ch.length - 1]!,
                x0,
                x1,
                y,
              })
            }
          }
        }
        i = j
      }
    }
  }
  return ops
}

function collectVerticalMergeOps(
  traces: Record<MspConnectionPairId, SolvedTracePath>,
  tolerance: number,
): VMergeOp[] {
  const byNet = new Map<string, VertSeg[]>()
  for (const mspPairId of Object.keys(traces)) {
    const path = traces[mspPairId]!.tracePath
    const net = traces[mspPairId]!.globalConnNetId
    for (let i = 0; i < path.length - 1; i++) {
      const p0 = path[i]!
      const p1 = path[i + 1]!
      const v = classifyVertical(p0, p1, tolerance)
      if (!v) continue
      const h = classifyHorizontal(p0, p1, tolerance)
      if (h) continue
      const bucket = bucketCoord(v.canonX, tolerance)
      const start = Math.min(p0.y, p1.y)
      const end = Math.max(p0.y, p1.y)
      const seg: VertSeg = {
        mspPairId,
        segIdx: i,
        start,
        end,
        canonX: v.canonX,
        bucket,
      }
      const list = byNet.get(net) ?? []
      list.push(seg)
      byNet.set(net, list)
    }
  }

  const ops: VMergeOp[] = []
  for (const segs of byNet.values()) {
    const uniqueBuckets = [...new Set(segs.map((s) => s.bucket))].sort(
      (a, b) => a - b,
    )
    const bucketClusters = clusterSortedBuckets(uniqueBuckets, tolerance)
    const bucketToCluster = new Map<number, number>()
    for (let ci = 0; ci < bucketClusters.length; ci++) {
      for (const bk of bucketClusters[ci]!) {
        bucketToCluster.set(bk, ci)
      }
    }
    for (let ci = 0; ci < bucketClusters.length; ci++) {
      const clusterSegs = segs.filter(
        (s) => bucketToCluster.get(s.bucket) === ci,
      )
      clusterSegs.sort((a, b) => a.start - b.start)
      let i = 0
      while (i < clusterSegs.length) {
        let curEnd = clusterSegs[i]!.end
        const group: VertSeg[] = [clusterSegs[i]!]
        let j = i + 1
        while (
          j < clusterSegs.length &&
          curEnd >= clusterSegs[j]!.start - tolerance
        ) {
          curEnd = Math.max(curEnd, clusterSegs[j]!.end)
          group.push(clusterSegs[j]!)
          j++
        }
        if (group.length > 1) {
          const y0 = Math.min(...group.map((g) => g.start))
          const y1 = Math.max(...group.map((g) => g.end))
          let sumX = 0
          let c = 0
          for (const g of group) {
            const pts = traces[g.mspPairId]!.tracePath
            const a = pts[g.segIdx]!
            const b = pts[g.segIdx + 1]!
            sumX += a.x + b.x
            c += 2
          }
          const x = sumX / c
          const byPath = new Map<MspConnectionPairId, number[]>()
          for (const g of group) {
            const arr = byPath.get(g.mspPairId) ?? []
            arr.push(g.segIdx)
            byPath.set(g.mspPairId, arr)
          }
          for (const [msp, idxs] of byPath) {
            idxs.sort((a, b) => a - b)
            const chains: number[][] = []
            let chain = [idxs[0]!]
            for (let k = 1; k < idxs.length; k++) {
              if (idxs[k] === idxs[k - 1]! + 1) {
                chain.push(idxs[k]!)
              } else {
                chains.push(chain)
                chain = [idxs[k]!]
              }
            }
            chains.push(chain)
            for (const ch of chains) {
              ops.push({
                mspPairId: msp,
                segFirst: ch[0]!,
                segLast: ch[ch.length - 1]!,
                y0,
                y1,
                x,
              })
            }
          }
        }
        i = j
      }
    }
  }
  return ops
}

function applyHorizontalMergeOps(
  traces: Record<MspConnectionPairId, SolvedTracePath>,
  ops: HMergeOp[],
) {
  ops.sort((a, b) => {
    if (a.mspPairId !== b.mspPairId) {
      return a.mspPairId.localeCompare(b.mspPairId)
    }
    return b.segFirst - a.segFirst
  })
  for (const op of ops) {
    const path = traces[op.mspPairId]!.tracePath
    const prev = op.segFirst > 0 ? path[op.segFirst - 1]! : null
    const next = op.segLast + 2 < path.length ? path[op.segLast + 2]! : null
    const [p0, p1] = orderHorizontalEndpoints(prev, next, op.x0, op.x1, op.y)
    traces[op.mspPairId]!.tracePath = spliceSegmentChain(
      path,
      op.segFirst,
      op.segLast,
      p0,
      p1,
    )
  }
}

function applyVerticalMergeOps(
  traces: Record<MspConnectionPairId, SolvedTracePath>,
  ops: VMergeOp[],
) {
  ops.sort((a, b) => {
    if (a.mspPairId !== b.mspPairId) {
      return a.mspPairId.localeCompare(b.mspPairId)
    }
    return b.segFirst - a.segFirst
  })
  for (const op of ops) {
    const path = traces[op.mspPairId]!.tracePath
    const prev = op.segFirst > 0 ? path[op.segFirst - 1]! : null
    const next = op.segLast + 2 < path.length ? path[op.segLast + 2]! : null
    const [p0, p1] = orderVerticalEndpoints(prev, next, op.y0, op.y1, op.x)
    traces[op.mspPairId]!.tracePath = spliceSegmentChain(
      path,
      op.segFirst,
      op.segLast,
      p0,
      p1,
    )
  }
}

function mergeTraceMapInPlace(
  traces: Record<MspConnectionPairId, SolvedTracePath>,
  tolerance: number,
) {
  const hOps = collectHorizontalMergeOps(traces, tolerance)
  applyHorizontalMergeOps(traces, hOps)
  const vOps = collectVerticalMergeOps(traces, tolerance)
  applyVerticalMergeOps(traces, vOps)
}

/**
 * Merges nearly collinear orthogonal segments on the same net (same
 * globalConnNetId) after overlap shifts are final.
 */
export class SameNetTraceLineMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  tolerance: number

  mergedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}

  constructor(params: {
    inputProblem: InputProblem
    correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath>
    tolerance?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.correctedTraceMap = params.correctedTraceMap
    this.tolerance = params.tolerance ?? 0.01
    this.mergedTraceMap = deepCloneTraceMap(params.correctedTraceMap)
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceLineMergeSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      correctedTraceMap: { ...this.mergedTraceMap },
      tolerance: this.tolerance,
    }
  }

  override _step() {
    mergeTraceMapInPlace(this.mergedTraceMap, this.tolerance)
    this.solved = true
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.15,
      connectionAlpha: 0.15,
    })
    for (const trace of Object.values(this.mergedTraceMap)) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "teal",
      })
    }
    return graphics
  }
}
