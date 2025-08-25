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
    // Shift only the overlapping segments, and move the shared endpoints
    // (the last point of the previous segment and the first point of the next
    // segment) so the polyline remains orthogonal without self-overlap.
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

    // For each net island group, shift only its overlapping segments and adjust adjacent joints
    this.overlappingTraceSegments.forEach((group, gidx) => {
      const offset = offsets[gidx]!

      // Gather unique segment indices per path
      const byPath: Map<number, Set<number>> = new Map()
      for (const loc of group.pathsWithOverlap) {
        if (!byPath.has(loc.solvedTracePathIndex)) {
          byPath.set(loc.solvedTracePathIndex, new Set())
        }
        byPath.get(loc.solvedTracePathIndex)!.add(loc.traceSegmentIndex)
      }

      for (const [pathIdx, segIdxSet] of byPath) {
        const original = this.traceNetIslands[group.connNetId][pathIdx]!
        const current = this.correctedTraceMap[original.mspPairId] ?? original
        const pts = current.tracePath.map((p) => ({ ...p }))

        const segIdxs = Array.from(segIdxSet).sort((a, b) => a - b)

        // Track per-point adjustments to avoid double-shifting shared joints
        const appliedX = new Set<number>()
        const appliedY = new Set<number>()

        for (const si of segIdxs) {
          if (si < 0 || si >= pts.length - 1) continue
          const start = pts[si]!
          const end = pts[si + 1]!
          const isVertical = Math.abs(start.x - end.x) < EPS
          const isHorizontal = Math.abs(start.y - end.y) < EPS

          if (!isVertical && !isHorizontal) continue

          if (isVertical) {
            if (!appliedX.has(si)) {
              start.x += offset
              appliedX.add(si)
            }
            if (!appliedX.has(si + 1)) {
              end.x += offset
              appliedX.add(si + 1)
            }
          } else if (isHorizontal) {
            if (!appliedY.has(si)) {
              start.y += offset
              appliedY.add(si)
            }
            if (!appliedY.has(si + 1)) {
              end.y += offset
              appliedY.add(si + 1)
            }
          }
        }

        // Remove consecutive duplicate points that might appear after shifts
        const cleaned: typeof pts = []
        for (const p of pts) {
          if (cleaned.length === 0 || !samePoint(cleaned[cleaned.length - 1], p)) {
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
