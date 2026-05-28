import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { Point } from "@tscircuit/math-utils"

const SNAP_THRESHOLD = 0.15

interface Segment {
  traceIndex: number
  segIndex: number
  p1: Point
  p2: Point
  isHorizontal: boolean
}

/**
 * Combines same-net trace segments that run close together (parallel and
 * nearly coincident) by snapping them onto a shared coordinate.
 *
 * Placed after TraceOverlapShiftSolver to clean up same-net redundancy
 * before net-label placement.
 */
export class SameNetTraceCombiningSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]

  private processed = false

  constructor(params: {
    inputProblem: InputProblem
    traces: SolvedTracePath[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.traces
    this.outputTraces = params.traces.map((t) => ({
      ...t,
      tracePath: t.tracePath.map((p) => ({ ...p })),
    }))
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceCombiningSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.inputTraces,
    }
  }

  override _step() {
    if (this.processed) {
      this.solved = true
      return
    }
    this.processed = true
    this.combineTraces()
    this.solved = true
  }

  private combineTraces() {
    const netGroups = new Map<string, number[]>()
    for (let i = 0; i < this.outputTraces.length; i++) {
      const netId = this.outputTraces[i]!.globalConnNetId
      if (!netGroups.has(netId)) netGroups.set(netId, [])
      netGroups.get(netId)!.push(i)
    }

    for (const indices of netGroups.values()) {
      if (indices.length < 2) continue
      this.combineGroup(indices)
    }
  }

  private combineGroup(traceIndices: number[]) {
    let changed = true
    let iterations = 0
    const maxIter = 20

    while (changed && iterations < maxIter) {
      changed = false
      iterations++

      const segments = this.collectSegments(traceIndices)

      const horizontals = segments.filter((s) => s.isHorizontal)
      const verticals = segments.filter((s) => !s.isHorizontal)

      if (this.snapParallelSegments(horizontals, true)) changed = true
      if (this.snapParallelSegments(verticals, false)) changed = true
    }
  }

  private collectSegments(traceIndices: number[]): Segment[] {
    const EPS = 1e-6
    const segments: Segment[] = []

    for (const ti of traceIndices) {
      const path = this.outputTraces[ti]!.tracePath
      for (let si = 0; si < path.length - 1; si++) {
        const p1 = path[si]!
        const p2 = path[si + 1]!
        const isHorizontal = Math.abs(p1.y - p2.y) < EPS
        const isVertical = Math.abs(p1.x - p2.x) < EPS
        if (!isHorizontal && !isVertical) continue
        segments.push({ traceIndex: ti, segIndex: si, p1, p2, isHorizontal })
      }
    }
    return segments
  }

  private snapParallelSegments(
    segments: Segment[],
    horizontal: boolean,
  ): boolean {
    let changed = false

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i]!
        const b = segments[j]!
        if (a.traceIndex === b.traceIndex) continue

        if (horizontal) {
          const dy = Math.abs(a.p1.y - b.p1.y)
          if (dy < 1e-6 || dy > SNAP_THRESHOLD) continue
          if (!this.rangesOverlap(a.p1.x, a.p2.x, b.p1.x, b.p2.x)) continue

          const avgY = (a.p1.y + b.p1.y) / 2
          this.shiftSegmentY(a, avgY)
          this.shiftSegmentY(b, avgY)
          changed = true
        } else {
          const dx = Math.abs(a.p1.x - b.p1.x)
          if (dx < 1e-6 || dx > SNAP_THRESHOLD) continue
          if (!this.rangesOverlap(a.p1.y, a.p2.y, b.p1.y, b.p2.y)) continue

          const avgX = (a.p1.x + b.p1.x) / 2
          this.shiftSegmentX(a, avgX)
          this.shiftSegmentX(b, avgX)
          changed = true
        }
      }
    }

    return changed
  }

  private rangesOverlap(
    a1: number,
    a2: number,
    b1: number,
    b2: number,
  ): boolean {
    const minA = Math.min(a1, a2)
    const maxA = Math.max(a1, a2)
    const minB = Math.min(b1, b2)
    const maxB = Math.max(b1, b2)
    return Math.min(maxA, maxB) - Math.max(minA, minB) > 1e-6
  }

  private shiftSegmentY(seg: Segment, newY: number) {
    const path = this.outputTraces[seg.traceIndex]!.tracePath
    const isFirstSeg = seg.segIndex === 0
    const isLastSeg = seg.segIndex === path.length - 2

    if (!isFirstSeg) {
      path[seg.segIndex]!.y = newY
    }
    if (!isLastSeg) {
      path[seg.segIndex + 1]!.y = newY
    }
  }

  private shiftSegmentX(seg: Segment, newX: number) {
    const path = this.outputTraces[seg.traceIndex]!.tracePath
    const isFirstSeg = seg.segIndex === 0
    const isLastSeg = seg.segIndex === path.length - 2

    if (!isFirstSeg) {
      path[seg.segIndex]!.x = newX
    }
    if (!isLastSeg) {
      path[seg.segIndex + 1]!.x = newX
    }
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    const lines = this.outputTraces.map((trace) => ({
      points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
      strokeColor: "blue",
    }))

    const base = visualizeInputProblem(this.inputProblem)
    return {
      ...base,
      lines: [...(base.lines ?? []), ...lines],
    }
  }
}
