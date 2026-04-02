import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { Point } from "@tscircuit/math-utils"

const COLLINEAR_TOLERANCE = 0.05
const GAP_TOLERANCE = 0.15

interface Segment {
  traceIndex: number
  segStart: number // index of first point in the segment within tracePath
  p1: Point
  p2: Point
  orientation: "horizontal" | "vertical"
}

/**
 * Merges collinear trace segments belonging to the same net that are close
 * together or overlapping, reducing visual clutter in schematics.
 */
export class SameNetTraceSegmentMergingSolver extends BaseSolver {
  private allTraces: SolvedTracePath[]
  private inputProblem: InputProblem
  private outputTraces: SolvedTracePath[]

  constructor(params: {
    allTraces: SolvedTracePath[]
    inputProblem: InputProblem
  }) {
    super()
    this.allTraces = params.allTraces
    this.inputProblem = params.inputProblem
    this.outputTraces = params.allTraces.map((t) => ({
      ...t,
      tracePath: [...t.tracePath],
    }))
  }

  override _step() {
    this.mergeCollinearSegments()
    this.solved = true
  }

  private mergeCollinearSegments() {
    // Group traces by globalConnNetId
    const netGroups = new Map<string, number[]>()
    for (let i = 0; i < this.outputTraces.length; i++) {
      const trace = this.outputTraces[i]
      const netId = trace.globalConnNetId
      if (!netGroups.has(netId)) {
        netGroups.set(netId, [])
      }
      netGroups.get(netId)!.push(i)
    }

    // Process each net group
    for (const [, traceIndices] of netGroups) {
      if (traceIndices.length < 2) continue
      this.mergeSegmentsInGroup(traceIndices)
    }
  }

  private mergeSegmentsInGroup(traceIndices: number[]) {
    // Extract all segments from all traces in this group
    const segments: Segment[] = []
    for (const traceIdx of traceIndices) {
      const trace = this.outputTraces[traceIdx]
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        const p1 = trace.tracePath[i]
        const p2 = trace.tracePath[i + 1]
        const dx = Math.abs(p2.x - p1.x)
        const dy = Math.abs(p2.y - p1.y)

        if (dx < COLLINEAR_TOLERANCE && dy >= COLLINEAR_TOLERANCE) {
          segments.push({
            traceIndex: traceIdx,
            segStart: i,
            p1,
            p2,
            orientation: "vertical",
          })
        } else if (dy < COLLINEAR_TOLERANCE && dx >= COLLINEAR_TOLERANCE) {
          segments.push({
            traceIndex: traceIdx,
            segStart: i,
            p1,
            p2,
            orientation: "horizontal",
          })
        }
      }
    }

    // Find mergeable pairs across different traces
    const merged = new Set<number>() // indices into segments array that were consumed

    for (let i = 0; i < segments.length; i++) {
      if (merged.has(i)) continue
      for (let j = i + 1; j < segments.length; j++) {
        if (merged.has(j)) continue
        if (segments[i].traceIndex === segments[j].traceIndex) continue
        if (segments[i].orientation !== segments[j].orientation) continue

        const canMerge = this.canMergeSegments(segments[i], segments[j])
        if (canMerge) {
          this.performMerge(segments[i], segments[j])
          merged.add(j)
        }
      }
    }
  }

  private canMergeSegments(a: Segment, b: Segment): boolean {
    if (a.orientation === "horizontal") {
      // Same y within tolerance
      const avgYa = (a.p1.y + a.p2.y) / 2
      const avgYb = (b.p1.y + b.p2.y) / 2
      if (Math.abs(avgYa - avgYb) > COLLINEAR_TOLERANCE) return false

      // Check x overlap or small gap
      const aMinX = Math.min(a.p1.x, a.p2.x)
      const aMaxX = Math.max(a.p1.x, a.p2.x)
      const bMinX = Math.min(b.p1.x, b.p2.x)
      const bMaxX = Math.max(b.p1.x, b.p2.x)

      const gap = Math.max(0, Math.max(aMinX, bMinX) - Math.min(aMaxX, bMaxX))
      return gap <= GAP_TOLERANCE
    }

    // Vertical
    const avgXa = (a.p1.x + a.p2.x) / 2
    const avgXb = (b.p1.x + b.p2.x) / 2
    if (Math.abs(avgXa - avgXb) > COLLINEAR_TOLERANCE) return false

    const aMinY = Math.min(a.p1.y, a.p2.y)
    const aMaxY = Math.max(a.p1.y, a.p2.y)
    const bMinY = Math.min(b.p1.y, b.p2.y)
    const bMaxY = Math.max(b.p1.y, b.p2.y)

    const gap = Math.max(0, Math.max(aMinY, bMinY) - Math.min(aMaxY, bMaxY))
    return gap <= GAP_TOLERANCE
  }

  private performMerge(a: Segment, b: Segment) {
    const traceA = this.outputTraces[a.traceIndex]
    const traceB = this.outputTraces[b.traceIndex]

    if (a.orientation === "horizontal") {
      const allX = [a.p1.x, a.p2.x, b.p1.x, b.p2.x]
      const minX = Math.min(...allX)
      const maxX = Math.max(...allX)
      const avgY = (a.p1.y + a.p2.y + b.p1.y + b.p2.y) / 4

      // Extend segment A to cover both
      traceA.tracePath[a.segStart] = { x: minX, y: avgY }
      traceA.tracePath[a.segStart + 1] = { x: maxX, y: avgY }

      // Collapse segment B to a single point (midpoint)
      const midX = (b.p1.x + b.p2.x) / 2
      traceB.tracePath[b.segStart] = { x: midX, y: avgY }
      traceB.tracePath[b.segStart + 1] = { x: midX, y: avgY }
    } else {
      const allY = [a.p1.y, a.p2.y, b.p1.y, b.p2.y]
      const minY = Math.min(...allY)
      const maxY = Math.max(...allY)
      const avgX = (a.p1.x + a.p2.x + b.p1.x + b.p2.x) / 4

      traceA.tracePath[a.segStart] = { x: avgX, y: minY }
      traceA.tracePath[a.segStart + 1] = { x: avgX, y: maxY }

      const midY = (b.p1.y + b.p2.y) / 2
      traceB.tracePath[b.segStart] = { x: avgX, y: midY }
      traceB.tracePath[b.segStart + 1] = { x: avgX, y: midY }
    }
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }
}
