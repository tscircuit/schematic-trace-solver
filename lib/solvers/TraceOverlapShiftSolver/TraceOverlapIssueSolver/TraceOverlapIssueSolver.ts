import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

type ConnNetId = string

export interface OverlappingTraceSegmentLocator {
  connNetId: string
  pathsWithOverlap: Array<{
    solvedTracePathIndex: number
    traceSegmentIndex: number
  }>
}

export class TraceOverlapIssueSolver extends BaseSolver {
  overlappingTraceSegments: OverlappingTraceSegmentLocator[]
  traceNetIslands: Record<ConnNetId, Array<SolvedTracePath>>

  SHIFT_DISTANCE = 0.1

  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}

  constructor(params: {
    overlappingTraceSegments: OverlappingTraceSegmentLocator[]
    traceNetIslands: Record<ConnNetId, Array<SolvedTracePath>>
  }) {
    super()
    this.overlappingTraceSegments = params.overlappingTraceSegments
    this.traceNetIslands = params.traceNetIslands

    // Only add the relevant traces to the correctedTraceMap
    for (const { connNetId, pathsWithOverlap } of this
      .overlappingTraceSegments) {
      for (const {
        solvedTracePathIndex,
        traceSegmentIndex,
      } of pathsWithOverlap) {
        const mspPairId =
          this.traceNetIslands[connNetId][solvedTracePathIndex].mspPairId
        this.correctedTraceMap[mspPairId] =
          this.traceNetIslands[connNetId][solvedTracePathIndex]
      }
    }
  }

  override _step() {
    // Apply shifts to resolve the current overlap set, but only to the specific
    // overlapping segments (introducing small jogs), not the entire trace.
    const EPS = 1e-6

    // Compute offsets for each island involved: alternate directions
    const offsets = this.overlappingTraceSegments.map((_, idx) => {
      const n = Math.floor(idx / 2) + 1
      const signed = idx % 2 === 0 ? -n : n
      return signed * this.SHIFT_DISTANCE
    })

    const eq = (a: number, b: number) => Math.abs(a - b) < EPS
    const samePoint = (
      p: { x: number; y: number } | undefined,
      q: { x: number; y: number } | undefined,
    ) => !!p && !!q && eq(p.x, q.x) && eq(p.y, q.y)

    // For each net island group, shift only its overlapping segments
    this.overlappingTraceSegments.forEach((group, gidx) => {
      const offset = offsets[gidx]!
      const byPath: Map<number, number[]> = new Map()
      for (const loc of group.pathsWithOverlap) {
        const arr = byPath.get(loc.solvedTracePathIndex) ?? []
        arr.push(loc.traceSegmentIndex)
        byPath.set(loc.solvedTracePathIndex, arr)
      }

      for (const [pathIdx, segIdxs] of byPath) {
        const original = this.traceNetIslands[group.connNetId][pathIdx]!
        const current = this.correctedTraceMap[original.mspPairId] ?? original
        const pts = current.tracePath

        // Sort segment indices to process in natural order
        segIdxs.sort((a, b) => a - b)

        const segIdxSet = new Set(segIdxs)
        const newPts: typeof pts = [pts[0]!]

        for (let si = 0; si < pts.length - 1; si++) {
          const start = pts[si]!
          const end = pts[si + 1]!

          if (!segIdxSet.has(si)) {
            // keep original segment
            if (!samePoint(newPts[newPts.length - 1], end)) {
              newPts.push(end)
            }
            continue
          }

          const isVertical = Math.abs(start.x - end.x) < EPS
          const isHorizontal = Math.abs(start.y - end.y) < EPS

          if (!isVertical && !isHorizontal) {
            // Non-orthogonal (unexpected); leave as-is
            if (!samePoint(newPts[newPts.length - 1], end)) {
              newPts.push(end)
            }
            continue
          }

          if (isVertical) {
            const q1 = { x: start.x + offset, y: start.y }
            const q2 = { x: end.x + offset, y: end.y }
            if (!samePoint(newPts[newPts.length - 1], q1)) newPts.push(q1)
            if (!samePoint(newPts[newPts.length - 1], q2)) newPts.push(q2)
            if (!samePoint(newPts[newPts.length - 1], end)) newPts.push(end)
          } else if (isHorizontal) {
            const q1 = { x: start.x, y: start.y + offset }
            const q2 = { x: end.x, y: end.y + offset }
            if (!samePoint(newPts[newPts.length - 1], q1)) newPts.push(q1)
            if (!samePoint(newPts[newPts.length - 1], q2)) newPts.push(q2)
            if (!samePoint(newPts[newPts.length - 1], end)) newPts.push(end)
          }
        }

        this.correctedTraceMap[original.mspPairId] = {
          ...current,
          tracePath: newPts,
        }
      }
    })

    this.solved = true
  }

  override visualize(): GraphicsObject {
    // Visualize overlapped segments and proposed corrections
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }

    // Draw overlapped segments in red
    for (const group of this.overlappingTraceSegments) {
      for (const { solvedTracePathIndex, traceSegmentIndex } of group
        .pathsWithOverlap) {
        const path = this.traceNetIslands[group.connNetId][
          solvedTracePathIndex
        ]!
        const segStart = path.tracePath[traceSegmentIndex]!
        const segEnd = path.tracePath[traceSegmentIndex + 1]!
        graphics.lines!.push({
          points: [segStart, segEnd],
          strokeColor: "red",
          strokeWidth: 0.006,
        })
      }
    }

    // Draw corrected traces (post-shift) in blue dashed
    for (const trace of Object.values(this.correctedTraceMap)) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "blue",
        strokeDash: "4 2",
        strokeWidth: 0.004,
      })
    }

    return graphics
  }
}
