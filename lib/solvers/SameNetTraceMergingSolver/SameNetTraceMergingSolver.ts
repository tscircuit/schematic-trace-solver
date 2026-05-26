import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { Point } from "@tscircuit/math-utils"

const EPS = 1e-6
const MERGE_DISTANCE_THRESHOLD = 0.3

interface Segment {
  traceIdx: number
  segIdx: number
  p1: Point
  p2: Point
  isHorizontal: boolean
  isVertical: boolean
  /** The constant coordinate (x for vertical, y for horizontal) */
  fixedCoord: number
  /** The start of the variable coordinate range */
  varStart: number
  /** The end of the variable coordinate range */
  varEnd: number
}

export class SameNetTraceMergingSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  mergedCount = 0

  constructor(params: {
    inputProblem: InputProblem
    traces: SolvedTracePath[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.traces
    this.outputTraces = params.traces.map((t) => ({
      ...t,
      tracePath: [...t.tracePath],
    }))
  }

  override _step() {
    const tracesByNet = this.groupTracesByNet()

    for (const [netId, traces] of tracesByNet) {
      if (traces.length < 2) continue
      this.mergeNetTraces(netId, traces)
    }

    this.solved = true
  }

  private groupTracesByNet(): Map<string, SolvedTracePath[]> {
    const map = new Map<string, SolvedTracePath[]>()
    for (const trace of this.outputTraces) {
      const key = trace.globalConnNetId
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(trace)
    }
    return map
  }

  private extractSegments(traces: SolvedTracePath[]): Segment[] {
    const segments: Segment[] = []
    for (let ti = 0; ti < traces.length; ti++) {
      const path = traces[ti]!.tracePath
      for (let si = 0; si < path.length - 1; si++) {
        const p1 = path[si]!
        const p2 = path[si + 1]!
        const isHorizontal = Math.abs(p1.y - p2.y) < EPS
        const isVertical = Math.abs(p1.x - p2.x) < EPS
        if (!isHorizontal && !isVertical) continue

        const fixedCoord = isVertical ? p1.x : p1.y
        const varStart = isVertical
          ? Math.min(p1.y, p2.y)
          : Math.min(p1.x, p2.x)
        const varEnd = isVertical
          ? Math.max(p1.y, p2.y)
          : Math.max(p1.x, p2.x)

        segments.push({
          traceIdx: ti,
          segIdx: si,
          p1,
          p2,
          isHorizontal,
          isVertical,
          fixedCoord,
          varStart,
          varEnd,
        })
      }
    }
    return segments
  }

  private mergeNetTraces(netId: string, traces: SolvedTracePath[]) {
    const segments = this.extractSegments(traces)
    const horizontalSegs = segments.filter((s) => s.isHorizontal)
    const verticalSegs = segments.filter((s) => s.isVertical)

    const merges: Array<{
      parentSeg: Segment
      childSeg: Segment
      overlapStart: number
      overlapEnd: number
    }> = []

    this.findMergeablePairs(horizontalSegs, "y", "x", merges)
    this.findMergeablePairs(verticalSegs, "x", "y", merges)

    for (const merge of merges) {
      this.applyMerge(merge, traces)
    }

    this.mergedCount = merges.length
  }

  private findMergeablePairs(
    segs: Segment[],
    fixedAxis: "x" | "y",
    varAxis: "x" | "y",
    merges: Array<{
      parentSeg: Segment
      childSeg: Segment
      overlapStart: number
      overlapEnd: number
    }>,
  ) {
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const a = segs[i]!
        const b = segs[j]!

        if (a.traceIdx === b.traceIdx) continue

        const fixedDiff = Math.abs(a.fixedCoord - b.fixedCoord)
        if (fixedDiff > MERGE_DISTANCE_THRESHOLD) continue

        const overlapStart = Math.max(a.varStart, b.varStart)
        const overlapEnd = Math.min(a.varEnd, b.varEnd)
        const overlapLen = overlapEnd - overlapStart

        if (overlapLen < 0.05) continue

        const aLen = a.varEnd - a.varStart
        const bLen = b.varEnd - b.varStart

        if (aLen < 0.01 || bLen < 0.01) continue

        merges.push({ parentSeg: a, childSeg: b, overlapStart, overlapEnd })
      }
    }
  }

  private getIntermediatePoints(
    p1: Point,
    p2: Point,
    p3: Point,
    p4: Point,
  ): Point[] {
    const pts: Point[] = [p1]
    if (p1.x !== p2.x || p1.y !== p2.y) pts.push(p2)
    if (p2.x !== p3.x || p2.y !== p3.y) pts.push(p3)
    if (p3.x !== p4.x || p3.y !== p4.y) pts.push(p4)
    return pts
  }

  private applyMerge(
    merge: {
      parentSeg: Segment
      childSeg: Segment
      overlapStart: number
      overlapEnd: number
    },
    traces: SolvedTracePath[],
  ) {
    const { parentSeg, childSeg, overlapStart, overlapEnd } = merge
    const childTrace = traces[childSeg.traceIdx]
    if (!childTrace) return

    const path = childTrace.tracePath

    const segStart = childSeg.segIdx
    const segEnd = childSeg.segIdx + 1

    if (segStart < 0 || segEnd >= path.length) return

    const midVar = (overlapStart + overlapEnd) / 2
    let midFixed: number
    if (childSeg.isVertical) {
      midFixed = parentSeg.fixedCoord
    } else {
      midFixed = parentSeg.fixedCoord
    }

    let pBefore = segStart > 0 ? path[segStart - 1] : null
    let pAfter = segEnd + 1 < path.length ? path[segEnd + 1] : null

    const elbowPoints: Point[] = []

    const segP1 = path[segStart]!
    const segP2 = path[segEnd]!

    if (pBefore) {
      if (childSeg.isVertical) {
        elbowPoints.push({ x: segP1.x, y: segP1.y })
        elbowPoints.push({ x: midFixed, y: segP1.y })
      } else {
        elbowPoints.push({ x: segP1.x, y: segP1.y })
        elbowPoints.push({ x: segP1.x, y: midFixed })
      }
    }

    const midPoint: Point = childSeg.isVertical
      ? { x: midFixed, y: midVar }
      : { x: midVar, y: midFixed }
    elbowPoints.push(midPoint)

    if (pAfter) {
      if (childSeg.isVertical) {
        elbowPoints.push({ x: midFixed, y: segP2.y })
        elbowPoints.push({ x: segP2.x, y: segP2.y })
      } else {
        elbowPoints.push({ x: segP2.x, y: midFixed })
        elbowPoints.push({ x: segP2.x, y: segP2.y })
      }
    }

    if (elbowPoints.length >= 2) {
      const replacement = this.simplifyMergePath(elbowPoints, pBefore, pAfter)
      const before = segStart > 0 ? path.slice(0, segStart) : []
      const after = segEnd + 1 < path.length ? path.slice(segEnd + 1) : []
      childTrace.tracePath = [...before, ...replacement, ...after]
    }
  }

  private simplifyMergePath(
    pts: Point[],
    pBefore: Point | null,
    pAfter: Point | null,
  ): Point[] {
    if (pts.length < 2) return pts
    const result: Point[] = [pts[0]!]
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = result[result.length - 1]
      const curr = pts[i]!
      const next = pts[i + 1]!
      const prevToCurrHoriz = Math.abs(prev.y - curr.y) < EPS
      const prevToCurrVert = Math.abs(prev.x - curr.x) < EPS
      const currToNextHoriz = Math.abs(curr.y - next.y) < EPS
      const currToNextVert = Math.abs(curr.x - next.x) < EPS

      if (
        (prevToCurrHoriz && currToNextHoriz) ||
        (prevToCurrVert && currToNextVert)
      ) {
        continue
      }
      result.push(curr)
    }
    result.push(pts[pts.length - 1]!)

    if (pBefore && result.length > 1) {
      const first = result[0]!
      const second = result[1]!
      if (Math.abs(first.x - pBefore.x) < EPS && Math.abs(first.y - pBefore.y) < EPS) {
        result.shift()
      }
    }

    return result
  }

  getOutput() {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })
    if (!graphics.lines) graphics.lines = []
    if (!graphics.points) graphics.points = []

    for (const trace of this.outputTraces) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "green",
      })
    }

    return graphics
  }
}
