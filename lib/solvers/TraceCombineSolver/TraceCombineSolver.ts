import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"

const EPS = 1e-6
const DEFAULT_COMBINE_DISTANCE = 0.1
const MAX_PASSES = 4

type SegmentRef = {
  traceIndex: number
  segmentIndex: number
  orientation: "horizontal" | "vertical"
  fixedAxisValue: number
  minAlong: number
  maxAlong: number
  length: number
}

export class TraceCombineSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  combineDistance: number

  constructor(params: {
    inputProblem: InputProblem
    traces: SolvedTracePath[]
    combineDistance?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.combineDistance = params.combineDistance ?? DEFAULT_COMBINE_DISTANCE
    this.traces = params.traces.map((trace) => ({
      ...trace,
      tracePath: trace.tracePath.map((p) => ({ ...p })),
    }))
  }

  override getConstructorParams(): ConstructorParameters<typeof TraceCombineSolver>[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.traces,
      combineDistance: this.combineDistance,
    }
  }

  override _step() {
    this.combineCloseSegments()
    this.traces = this.traces.map((trace) => ({
      ...trace,
      tracePath: this.normalizePath(trace.tracePath),
    }))
    this.solved = true
  }

  private combineCloseSegments() {
    const tracesByNet: Record<string, number[]> = {}
    for (let i = 0; i < this.traces.length; i++) {
      const net = this.traces[i]!.globalConnNetId
      if (!tracesByNet[net]) tracesByNet[net] = []
      tracesByNet[net]!.push(i)
    }

    for (const traceIndices of Object.values(tracesByNet)) {
      let changed = true
      let pass = 0
      while (changed && pass < MAX_PASSES) {
        changed = false
        pass += 1
        for (let i = 0; i < traceIndices.length; i++) {
          for (let j = i + 1; j < traceIndices.length; j++) {
            const a = traceIndices[i]!
            const b = traceIndices[j]!
            const merged = this.tryMergeTracePair(a, b)
            if (merged) {
              changed = true
            }
          }
        }
      }
    }
  }

  private tryMergeTracePair(traceIndexA: number, traceIndexB: number): boolean {
    const traceA = this.traces[traceIndexA]!
    const traceB = this.traces[traceIndexB]!
    const segsA = this.getSegments(traceA.tracePath, traceIndexA)
    const segsB = this.getSegments(traceB.tracePath, traceIndexB)

    for (const segA of segsA) {
      for (const segB of segsB) {
        if (segA.orientation !== segB.orientation) continue
        if (!this.rangesTouchOrOverlap(segA.minAlong, segA.maxAlong, segB.minAlong, segB.maxAlong)) {
          continue
        }

        const axisDistance = Math.abs(segA.fixedAxisValue - segB.fixedAxisValue)
        if (axisDistance > this.combineDistance) continue

        const moveA = segA.length < segB.length
        const targetAxis = moveA ? segB.fixedAxisValue : segA.fixedAxisValue
        const source = moveA ? segA : segB
        const moved = this.moveSegmentToAxis(source, targetAxis)
        if (moved) {
          return true
        }
      }
    }

    return false
  }

  private getSegments(path: SolvedTracePath["tracePath"], traceIndex: number): SegmentRef[] {
    const segments: SegmentRef[] = []
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i]!
      const p2 = path[i + 1]!
      if (Math.abs(p1.x - p2.x) < EPS) {
        const minAlong = Math.min(p1.y, p2.y)
        const maxAlong = Math.max(p1.y, p2.y)
        segments.push({
          traceIndex,
          segmentIndex: i,
          orientation: "vertical",
          fixedAxisValue: p1.x,
          minAlong,
          maxAlong,
          length: maxAlong - minAlong,
        })
      } else if (Math.abs(p1.y - p2.y) < EPS) {
        const minAlong = Math.min(p1.x, p2.x)
        const maxAlong = Math.max(p1.x, p2.x)
        segments.push({
          traceIndex,
          segmentIndex: i,
          orientation: "horizontal",
          fixedAxisValue: p1.y,
          minAlong,
          maxAlong,
          length: maxAlong - minAlong,
        })
      }
    }
    return segments
  }

  private rangesTouchOrOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
    return Math.min(aMax, bMax) - Math.max(aMin, bMin) >= -EPS
  }

  private moveSegmentToAxis(seg: SegmentRef, targetAxis: number): boolean {
    const path = this.traces[seg.traceIndex]!.tracePath
    const i = seg.segmentIndex
    const p1 = path[i]!
    const p2 = path[i + 1]!
    const oldP1 = { ...p1 }
    const oldP2 = { ...p2 }

    if (seg.orientation === "horizontal") {
      p1.y = targetAxis
      p2.y = targetAxis
    } else {
      p1.x = targetAxis
      p2.x = targetAxis
    }

    const valid =
      this.isSegmentOrthogonal(path, i - 1) &&
      this.isSegmentOrthogonal(path, i) &&
      this.isSegmentOrthogonal(path, i + 1)

    if (!valid) {
      p1.x = oldP1.x
      p1.y = oldP1.y
      p2.x = oldP2.x
      p2.y = oldP2.y
      return false
    }

    return true
  }

  private isSegmentOrthogonal(
    path: SolvedTracePath["tracePath"],
    segmentIndex: number,
  ): boolean {
    if (segmentIndex < 0 || segmentIndex >= path.length - 1) return true
    const a = path[segmentIndex]!
    const b = path[segmentIndex + 1]!
    return Math.abs(a.x - b.x) < EPS || Math.abs(a.y - b.y) < EPS
  }

  private normalizePath(path: SolvedTracePath["tracePath"]) {
    if (path.length < 2) return path
    const deduped = [path[0]!]
    for (let i = 1; i < path.length; i++) {
      const prev = deduped[deduped.length - 1]!
      const cur = path[i]!
      if (Math.abs(prev.x - cur.x) < EPS && Math.abs(prev.y - cur.y) < EPS) {
        continue
      }
      deduped.push(cur)
    }
    return simplifyPath(deduped)
  }

  getOutput() {
    return {
      traces: this.traces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.15,
      connectionAlpha: 0.1,
    })
    for (const trace of this.traces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "green",
      })
    }
    return graphics
  }
}
