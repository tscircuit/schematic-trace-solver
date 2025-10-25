import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { applyJogToTerminalSegment } from "./applyJogToTrace"

type ConnNetId = string
type Point = { x: number; y: number }

export interface OverlappingTraceSegmentLocator {
  connNetId: string
  pathsWithOverlap: Array<{
    solvedTracePathIndex: number
    traceSegmentIndex: number
  }>
}

interface TraceOffsetConfig {
  maxBruteForceSize: number
  shiftDistance: number
  strategy: "brute-force" | "greedy"
}

export class TraceOverlapIssueSolver extends BaseSolver {
  overlappingTraceSegments: OverlappingTraceSegmentLocator[]
  traceNetIslands: Record<ConnNetId, Array<SolvedTracePath>>
  SHIFT_DISTANCE = 2.0 // Distance to shift traces for better visibility
  EPS = 1e-6 // Small number for floating point comparisons

  // Storage for corrected traces
  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}

  constructor(params: {
    overlappingTraceSegments: OverlappingTraceSegmentLocator[]
    traceNetIslands: Record<ConnNetId, Array<SolvedTracePath>>
  }) {
    super()
    this.overlappingTraceSegments = params.overlappingTraceSegments
    this.traceNetIslands = params.traceNetIslands
  }

  private segmentsIntersect(
    a1: Point,
    a2: Point,
    b1: Point,
    b2: Point,
  ): boolean {
    // Quick check for parallel segments (they can't cross)
    if (Math.abs(a1.x - a2.x) < this.EPS && Math.abs(b1.x - b2.x) < this.EPS) {
      return false // Both vertical
    }
    if (Math.abs(a1.y - a2.y) < this.EPS && Math.abs(b1.y - b2.y) < this.EPS) {
      return false // Both horizontal
    }

    // Check if their bounding boxes overlap
    const ax1 = Math.min(a1.x, a2.x),
      ax2 = Math.max(a1.x, a2.x)
    const ay1 = Math.min(a1.y, a2.y),
      ay2 = Math.max(a1.y, a2.y)
    const bx1 = Math.min(b1.x, b2.x),
      bx2 = Math.max(b1.x, b2.x)
    const by1 = Math.min(b1.y, b2.y),
      by2 = Math.max(b1.y, b2.y)

    return !(ax2 < bx1 || bx2 < ax1 || ay2 < by1 || by2 < ay1)
  }

  override _step() {
    const config: TraceOffsetConfig = {
      maxBruteForceSize: 10,
      shiftDistance: this.SHIFT_DISTANCE,
      strategy: "brute-force",
    }

    const eq = (a: number, b: number) => Math.abs(a - b) < this.EPS
    const samePoint = (
      p: { x: number; y: number } | undefined,
      q: { x: number; y: number } | undefined,
    ) => !!p && !!q && eq(p.x, q.x) && eq(p.y, q.y)

    this.overlappingTraceSegments.forEach((group, gidx) => {
      const numTraces = group.pathsWithOverlap.length
      const stepSize = config.shiftDistance

      const offsets = group.pathsWithOverlap.map(
        (_, idx) => (idx - (numTraces - 1) / 2) * stepSize * 2,
      )

      const byPath: Map<number, Set<number>> = new Map()
      for (const loc of group.pathsWithOverlap) {
        if (!byPath.has(loc.solvedTracePathIndex)) {
          byPath.set(loc.solvedTracePathIndex, new Set())
        }
        byPath.get(loc.solvedTracePathIndex)!.add(loc.traceSegmentIndex)
      }

      const offset = offsets[gidx]!

      for (const [pathIdx, segIdxSet] of byPath) {
        const original = this.traceNetIslands[group.connNetId][pathIdx]!
        const current = this.correctedTraceMap[original.mspPairId] ?? original
        const pts = current.tracePath.map((p) => ({ ...p }))

        const segIdxsRev = Array.from(segIdxSet)
          .sort((a, b) => a - b)
          .reverse()

        const JOG_SIZE = this.SHIFT_DISTANCE

        for (const si of segIdxsRev) {
          if (si < 0 || si >= pts.length - 1) continue

          if (si === 0 || si === pts.length - 2) {
            applyJogToTerminalSegment({
              pts,
              segmentIndex: si,
              offset,
              JOG_SIZE,
              EPS: this.EPS,
            })
          } else {
            const start = pts[si]!
            const end = pts[si + 1]!
            const isVertical = Math.abs(start.x - end.x) < this.EPS
            const isHorizontal = Math.abs(start.y - end.y) < this.EPS
            if (!isVertical && !isHorizontal) continue

            if (isVertical) {
              start.x += offset
              end.x += offset
            } else {
              start.y += offset
              end.y += offset
            }
          }
        }

        const cleaned: typeof pts = []
        for (const p of pts) {
          if (
            cleaned.length === 0 ||
            !samePoint(cleaned[cleaned.length - 1], p)
          ) {
            cleaned.push(p)
          }
        }

        this.correctedTraceMap[original.mspPairId] = {
          ...current,
          tracePath: cleaned,
        }
      }
    })

    this.solved = true
  }

  override visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }

    // Draw overlapped segments in red
    for (const group of this.overlappingTraceSegments) {
      for (const {
        solvedTracePathIndex,
        traceSegmentIndex,
      } of group.pathsWithOverlap) {
        const path =
          this.traceNetIslands[group.connNetId][solvedTracePathIndex]!
        const segStart = path.tracePath[traceSegmentIndex]!
        const segEnd = path.tracePath[traceSegmentIndex + 1]!
        graphics.lines!.push({
          points: [segStart, segEnd],
          strokeColor: "red",
        })
      }
    }

    // Draw corrected traces (post-shift) in blue dashed
    for (const trace of Object.values(this.correctedTraceMap)) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "blue",
        strokeDash: "4 2",
      })
    }

    return graphics
  }
}
