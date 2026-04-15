import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { GraphicsObject } from "graphics-debug"
import type { Point } from "@tscircuit/math-utils"

const GAP_THRESHOLD = 0.15

interface Segment {
  start: Point
  end: Point
  orientation: "horizontal" | "vertical"
  fixedCoord: number
  minVar: number
  maxVar: number
  traceIndex: number
  segmentIndex: number
}

export class SameNetTraceMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  netIds: string[]
  currentNetIndex = 0

  constructor(params: {
    inputProblem: InputProblem
    inputTraces: SolvedTracePath[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.inputTraces
    this.outputTraces = params.inputTraces.map((t) => ({
      ...t,
      tracePath: [...t.tracePath],
    }))

    const netSet = new Set<string>()
    for (const trace of this.outputTraces) {
      netSet.add(trace.globalConnNetId)
    }
    this.netIds = Array.from(netSet)
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceMergeSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTraces: this.inputTraces,
    }
  }

  override _step() {
    if (this.currentNetIndex >= this.netIds.length) {
      this.solved = true
      return
    }

    const netId = this.netIds[this.currentNetIndex]!
    const traceIndices: number[] = []
    for (let i = 0; i < this.outputTraces.length; i++) {
      if (this.outputTraces[i]!.globalConnNetId === netId) {
        traceIndices.push(i)
      }
    }

    if (traceIndices.length >= 2) {
      this.mergeCloseSegmentsForNet(traceIndices)
    }

    this.currentNetIndex++
  }

  private extractSegments(traceIndex: number): Segment[] {
    const trace = this.outputTraces[traceIndex]!
    const segments: Segment[] = []
    const path = trace.tracePath

    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i]!
      const p2 = path[i + 1]!

      const dx = Math.abs(p2.x - p1.x)
      const dy = Math.abs(p2.y - p1.y)

      if (dx < 1e-9 && dy < 1e-9) continue

      if (dx < 1e-9) {
        segments.push({
          start: p1,
          end: p2,
          orientation: "vertical",
          fixedCoord: p1.x,
          minVar: Math.min(p1.y, p2.y),
          maxVar: Math.max(p1.y, p2.y),
          traceIndex,
          segmentIndex: i,
        })
      } else if (dy < 1e-9) {
        segments.push({
          start: p1,
          end: p2,
          orientation: "horizontal",
          fixedCoord: p1.y,
          minVar: Math.min(p1.x, p2.x),
          maxVar: Math.max(p1.x, p2.x),
          traceIndex,
          segmentIndex: i,
        })
      }
    }

    return segments
  }

  private segmentsOverlap(a: Segment, b: Segment): boolean {
    return a.minVar < b.maxVar && b.minVar < a.maxVar
  }

  private mergeCloseSegmentsForNet(traceIndices: number[]) {
    const allSegments: Segment[] = []
    for (const idx of traceIndices) {
      allSegments.push(...this.extractSegments(idx))
    }

    const mergeOps: Array<{
      seg: Segment
      targetCoord: number
    }> = []

    for (let i = 0; i < allSegments.length; i++) {
      for (let j = i + 1; j < allSegments.length; j++) {
        const a = allSegments[i]!
        const b = allSegments[j]!

        if (a.traceIndex === b.traceIndex) continue
        if (a.orientation !== b.orientation) continue

        const gap = Math.abs(a.fixedCoord - b.fixedCoord)
        if (gap > GAP_THRESHOLD || gap < 1e-9) continue

        if (!this.segmentsOverlap(a, b)) continue

        const midCoord = (a.fixedCoord + b.fixedCoord) / 2
        mergeOps.push({ seg: a, targetCoord: midCoord })
        mergeOps.push({ seg: b, targetCoord: midCoord })
      }
    }

    for (const op of mergeOps) {
      this.shiftSegment(op.seg, op.targetCoord)
    }
  }

  private shiftSegment(seg: Segment, targetCoord: number) {
    const trace = this.outputTraces[seg.traceIndex]!
    const path = trace.tracePath
    const i = seg.segmentIndex

    if (i >= path.length - 1) return

    const p1 = path[i]!
    const p2 = path[i + 1]!

    if (seg.orientation === "horizontal") {
      path[i] = { x: p1.x, y: targetCoord }
      path[i + 1] = { x: p2.x, y: targetCoord }

      if (i > 0) {
        const prev = path[i - 1]!
        if (Math.abs(prev.x - p1.x) < 1e-9) {
          path[i - 1] = { x: prev.x, y: prev.y }
        }
      }
      if (i + 2 < path.length) {
        const next = path[i + 2]!
        if (Math.abs(next.x - p2.x) < 1e-9) {
          path[i + 2] = { x: next.x, y: next.y }
        }
      }
    } else {
      path[i] = { x: targetCoord, y: p1.y }
      path[i + 1] = { x: targetCoord, y: p2.y }

      if (i > 0) {
        const prev = path[i - 1]!
        if (Math.abs(prev.y - p1.y) < 1e-9) {
          path[i - 1] = { x: prev.x, y: prev.y }
        }
      }
      if (i + 2 < path.length) {
        const next = path[i + 2]!
        if (Math.abs(next.y - p2.y) < 1e-9) {
          path[i + 2] = { x: next.x, y: next.y }
        }
      }
    }
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)

    for (const trace of this.outputTraces) {
      graphics.lines = graphics.lines ?? []
      graphics.lines.push({
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "blue",
      })
    }

    return graphics
  }
}
