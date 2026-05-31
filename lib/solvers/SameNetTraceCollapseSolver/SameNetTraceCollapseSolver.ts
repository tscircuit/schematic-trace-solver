import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { Point } from "@tscircuit/math-utils"

const EPS = 1e-9
const COLLAPSE_GAP = 0.3

interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
  isHorizontal: boolean
}

function simplifyPath(path: Point[]): Point[] {
  if (path.length <= 2) return path
  const result: Point[] = [path[0]]
  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1]
    const curr = path[i]
    const next = path[i + 1]
    const prevVert = Math.abs(prev.x - curr.x) < EPS
    const currVert = Math.abs(curr.x - next.x) < EPS
    const prevHorz = Math.abs(prev.y - curr.y) < EPS
    const currHorz = Math.abs(curr.y - next.y) < EPS
    if ((prevVert && currVert) || (prevHorz && currHorz)) continue
    result.push(curr)
  }
  result.push(path[path.length - 1])
  return result
}

function segmentsEqual(a: Segment, b: Segment): boolean {
  const sameDirs = a.isHorizontal === b.isHorizontal
  if (!sameDirs) return false
  if (a.isHorizontal) {
    return (
      Math.abs(a.y1 - b.y1) < EPS &&
      Math.abs(Math.min(a.x1, a.x2) - Math.min(b.x1, b.x2)) < EPS &&
      Math.abs(Math.max(a.x1, a.x2) - Math.max(b.x1, b.x2)) < EPS
    )
  }
  return (
    Math.abs(a.x1 - b.x1) < EPS &&
    Math.abs(Math.min(a.y1, a.y2) - Math.min(b.y1, b.y2)) < EPS &&
    Math.abs(Math.max(a.y1, a.y2) - Math.max(b.y1, b.y2)) < EPS
  )
}

function mergeSegments(segments: Segment[], isHorizontal: boolean): Segment[] {
  if (segments.length <= 1) return segments

  const sorted = [...segments].sort((a, b) => {
    const coord = isHorizontal ? "x1" as const : "y1" as const
    const aMin = Math.min(a[coord], isHorizontal ? a.x2 : a.y2)
    const bMin = Math.min(b[coord], isHorizontal ? b.x2 : b.y2)
    return aMin - bMin
  })

  const merged: Segment[] = []
  let current = { ...sorted[0] }

  for (let i = 1; i < sorted.length; i++) {
    const seg = sorted[i]
    if (isHorizontal) {
      const curMin = Math.min(current.x1, current.x2)
      const curMax = Math.max(current.x1, current.x2)
      const segMin = Math.min(seg.x1, seg.x2)
      const segMax = Math.max(seg.x1, seg.x2)

      if (segMin <= curMax + COLLAPSE_GAP) {
        const newMax = Math.max(curMax, segMax)
        if (current.x1 <= current.x2) {
          current.x1 = curMin
          current.x2 = newMax
        } else {
          current.x1 = newMax
          current.x2 = curMin
        }
      } else {
        merged.push({ ...current })
        current = { ...seg }
      }
    } else {
      const curMin = Math.min(current.y1, current.y2)
      const curMax = Math.max(current.y1, current.y2)
      const segMin = Math.min(seg.y1, seg.y2)
      const segMax = Math.max(seg.y1, seg.y2)

      if (segMin <= curMax + COLLAPSE_GAP) {
        const newMax = Math.max(curMax, segMax)
        if (current.y1 <= current.y2) {
          current.y1 = curMin
          current.y2 = newMax
        } else {
          current.y1 = newMax
          current.y2 = curMin
        }
      } else {
        merged.push({ ...current })
        current = { ...seg }
      }
    }
  }
  merged.push(current)

  return merged
}

function pointKey(p: Point): string {
  return `${p.x.toFixed(8)},${p.y.toFixed(8)}`
}

function pointDist(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function findShortestPath(
  graph: Map<string, Map<string, number>>,
  start: Point,
  end: Point,
): Point[] | null {
  const startKey = pointKey(start)
  const endKey = pointKey(end)

  if (startKey === endKey) return [start]

  const dist = new Map<string, number>()
  const prev = new Map<string, string>()
  const queue: string[] = []

  dist.set(startKey, 0)
  queue.push(startKey)

  while (queue.length > 0) {
    queue.sort((a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity))
    const current = queue.shift()!

    if (current === endKey) break

    const neighbors = graph.get(current)
    if (!neighbors) continue

    const currentDist = dist.get(current) ?? Infinity

    for (const [neighbor, edgeLen] of neighbors) {
      const newDist = currentDist + edgeLen
      if (newDist < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, newDist)
        prev.set(neighbor, current)
        if (!queue.includes(neighbor)) queue.push(neighbor)
      }
    }
  }

  if (!prev.has(endKey) && startKey !== endKey) return null

  const path: string[] = []
  let current = endKey
  while (current !== startKey) {
    path.unshift(current)
    const p = prev.get(current)
    if (!p) return null
    current = p
  }
  path.unshift(startKey)

  return path.map((key) => {
    const [x, y] = key.split(",").map(Number)
    return { x, y }
  })
}

function extractSegments(traces: SolvedTracePath[]): Segment[] {
  const segments: Segment[] = []
  const seen = new Set<string>()

  for (const trace of traces) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const p1 = trace.tracePath[i]
      const p2 = trace.tracePath[i + 1]

      const isH = Math.abs(p1.y - p2.y) < EPS
      const isV = Math.abs(p1.x - p2.x) < EPS
      if (!isH && !isV) continue

      const seg: Segment = {
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        isHorizontal: isH,
      }
      const key = `${seg.isHorizontal}:${seg.x1.toFixed(8)}:${seg.y1.toFixed(8)}:${seg.x2.toFixed(8)}:${seg.y2.toFixed(8)}`
      if (seen.has(key)) continue
      seen.add(key)
      segments.push(seg)
    }
  }

  return segments
}

export class SameNetTraceCollapseSolver extends BaseSolver {
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  inputProblem: InputProblem

  constructor(params: { inputProblem: InputProblem; inputTraces: SolvedTracePath[] }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.inputTraces
    this.outputTraces = []
  }

  override _step() {
    const nets = new Map<string, SolvedTracePath[]>()

    for (const trace of this.inputTraces) {
      const netId = trace.globalConnNetId
      if (!nets.has(netId)) nets.set(netId, [])
      nets.get(netId)!.push(trace)
    }

    for (const [, traces] of nets) {
      if (traces.length === 0) continue

      const allSegments = extractSegments(traces)

      const horzByY = new Map<number, Segment[]>()
      const vertByX = new Map<number, Segment[]>()

      for (const seg of allSegments) {
        if (seg.isHorizontal) {
          const y = seg.y1
          let found = false
          for (const [key] of horzByY) {
            if (Math.abs(key - y) < COLLAPSE_GAP) {
              horzByY.get(key)!.push(seg)
              found = true
              break
            }
          }
          if (!found) horzByY.set(y, [seg])
        } else {
          const x = seg.x1
          let found = false
          for (const [key] of vertByX) {
            if (Math.abs(key - x) < COLLAPSE_GAP) {
              vertByX.get(key)!.push(seg)
              found = true
              break
            }
          }
          if (!found) vertByX.set(x, [seg])
        }
      }

      const mergedHorz: Segment[] = []
      for (const [, segs] of horzByY) {
        const merged = mergeSegments(segs, true)
        mergedHorz.push(...merged)
      }

      const mergedVert: Segment[] = []
      for (const [, segs] of vertByX) {
        const merged = mergeSegments(segs, false)
        mergedVert.push(...merged)
      }

      const allMerged = [...mergedHorz, ...mergedVert]

      const graph = new Map<string, Map<string, number>>()
      for (const seg of allMerged) {
        const pk1 = pointKey({ x: seg.x1, y: seg.y1 })
        const pk2 = pointKey({ x: seg.x2, y: seg.y2 })
        if (!graph.has(pk1)) graph.set(pk1, new Map())
        if (!graph.has(pk2)) graph.set(pk2, new Map())

        const len = pointDist({ x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 })
        graph.get(pk1)!.set(pk2, len)
        graph.get(pk2)!.set(pk1, len)
      }

      for (const trace of traces) {
        const path = trace.tracePath
        if (path.length < 2) {
          this.outputTraces.push({ ...trace })
          continue
        }

        const startPoint = path[0]
        const endPoint = path[path.length - 1]

        const newPath = findShortestPath(graph, startPoint, endPoint)

        if (!newPath || newPath.length < 2) {
          this.outputTraces.push({ ...trace })
          continue
        }

        const simplified = simplifyPath(newPath)

        this.outputTraces.push({
          ...trace,
          tracePath: simplified,
        })
      }
    }

    if (nets.size === 0) {
      this.outputTraces = [...this.inputTraces]
    }

    this.solved = true
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    if (!graphics.lines) graphics.lines = []
    if (!graphics.points) graphics.points = []

    const netColors = new Map<string, string>()
    let colorIdx = 0
    const colors = [
      "red", "blue", "green", "purple", "orange",
      "teal", "magenta", "brown", "pink", "cyan",
    ]

    for (const trace of this.inputTraces) {
      const netId = trace.globalConnNetId
      if (!netColors.has(netId)) {
        netColors.set(netId, colors[colorIdx % colors.length]!)
        colorIdx++
      }
    }

    for (const trace of this.inputTraces) {
      const color = netColors.get(trace.globalConnNetId) ?? "gray"
      graphics.lines!.push({
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: color,
        strokeDash: "4 2",
        strokeWidth: 0.02,
      })
    }

    for (const trace of this.outputTraces) {
      const color = netColors.get(trace.globalConnNetId) ?? "gray"
      graphics.lines!.push({
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: color,
        strokeWidth: 0.04,
      })
    }

    return graphics
  }
}
