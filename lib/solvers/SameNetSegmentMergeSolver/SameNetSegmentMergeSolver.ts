import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"

const MERGE_THRESHOLD = 0.05

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function pointToSegmentDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy })
}

function closestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return a
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
  return { x: a.x + t * dx, y: a.y + t * dy }
}

function isInteriorPoint(p: Point, a: Point, b: Point): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return false
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  return t > 1e-6 && t < 1 - 1e-6
}

/**
 * Detects and merges trace segments from the same net that are nearly
 * coincident (within MERGE_THRESHOLD). When two same-net traces share a
 * parallel overlapping segment, one is snapped to the other, removing the
 * visual duplication seen in the schematic.
 */
export class SameNetSegmentMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: SolvedTracePath[]
  outputTracePaths: SolvedTracePath[]

  constructor(params: {
    inputProblem: InputProblem
    traces: SolvedTracePath[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.traces
    this.outputTracePaths = []
    this.MAX_ITERATIONS = 1
  }

  override _step() {
    const traces: SolvedTracePath[] = this.inputTracePaths.map((t) => ({
      ...t,
      tracePath: t.tracePath.map((p) => ({ ...p })),
    }))

    // Group by net
    const byNet = new Map<string, SolvedTracePath[]>()
    for (const trace of traces) {
      const netId = trace.globalConnNetId
      if (!byNet.has(netId)) byNet.set(netId, [])
      byNet.get(netId)!.push(trace)
    }

    for (const [, group] of byNet) {
      if (group.length < 2) continue
      this._mergeGroup(group)
    }

    this.outputTracePaths = traces
    this.solved = true
  }

  _mergeGroup(traces: SolvedTracePath[]) {
    // For each trace, snap endpoints that are close to an interior point of
    // another trace in the same net. This eliminates the near-coincident
    // segment duplication shown in the issue.
    for (let i = 0; i < traces.length; i++) {
      for (let j = 0; j < traces.length; j++) {
        if (i === j) continue
        const target = traces[j]
        const path = traces[i].tracePath

        for (let k = 0; k < path.length; k++) {
          const pt = path[k]
          for (let s = 0; s < target.tracePath.length - 1; s++) {
            const a = target.tracePath[s]
            const b = target.tracePath[s + 1]
            const d = pointToSegmentDist(pt, a, b)
            if (d < MERGE_THRESHOLD && isInteriorPoint(pt, a, b)) {
              const snapped = closestPointOnSegment(pt, a, b)
              path[k] = snapped
            }
          }
        }
      }
    }

    // Second pass: detect and merge nearly-coincident parallel segments
    this._deduplicateCoincidentSegments(traces)
  }

  _deduplicateCoincidentSegments(traces: SolvedTracePath[]) {
    for (let i = 0; i < traces.length; i++) {
      for (let j = i + 1; j < traces.length; j++) {
        const pathA = traces[i].tracePath
        const pathB = traces[j].tracePath

        for (let si = 0; si < pathA.length - 1; si++) {
          const a1 = pathA[si]
          const a2 = pathA[si + 1]
          const isHorizA = Math.abs(a1.y - a2.y) < 1e-9
          const isVertA = Math.abs(a1.x - a2.x) < 1e-9

          for (let sj = 0; sj < pathB.length - 1; sj++) {
            const b1 = pathB[sj]
            const b2 = pathB[sj + 1]
            const isHorizB = Math.abs(b1.y - b2.y) < 1e-9
            const isVertB = Math.abs(b1.x - b2.x) < 1e-9

            if (isHorizA && isHorizB) {
              const yDist = Math.abs(a1.y - b1.y)
              if (yDist > MERGE_THRESHOLD) continue
              const aMinX = Math.min(a1.x, a2.x)
              const aMaxX = Math.max(a1.x, a2.x)
              const bMinX = Math.min(b1.x, b2.x)
              const bMaxX = Math.max(b1.x, b2.x)
              const overlapMin = Math.max(aMinX, bMinX)
              const overlapMax = Math.min(aMaxX, bMaxX)
              if (overlapMax - overlapMin < 1e-9) continue
              // Snap B's segment onto A's y-coordinate
              pathB[sj] = { ...b1, y: a1.y }
              pathB[sj + 1] = { ...b2, y: a1.y }
            } else if (isVertA && isVertB) {
              const xDist = Math.abs(a1.x - b1.x)
              if (xDist > MERGE_THRESHOLD) continue
              const aMinY = Math.min(a1.y, a2.y)
              const aMaxY = Math.max(a1.y, a2.y)
              const bMinY = Math.min(b1.y, b2.y)
              const bMaxY = Math.max(b1.y, b2.y)
              const overlapMin = Math.max(aMinY, bMinY)
              const overlapMax = Math.min(aMaxY, bMaxY)
              if (overlapMax - overlapMin < 1e-9) continue
              // Snap B's segment onto A's x-coordinate
              pathB[sj] = { ...b1, x: a1.x }
              pathB[sj + 1] = { ...b2, x: a1.x }
            }
          }
        }
      }
    }
  }

  getOutput() {
    return { traces: this.outputTracePaths }
  }

  override visualize() {
    return (
      this.activeSubSolver?.visualize() ??
      this.inputTracePaths[0]
        ? { lines: [], points: [], rects: [], texts: [], circles: [] }
        : { lines: [], points: [], rects: [], texts: [], circles: [] }
    )
  }
}
