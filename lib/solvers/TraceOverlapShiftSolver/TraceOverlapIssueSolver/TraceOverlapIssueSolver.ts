import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { applyJogToTerminalSegment } from "./applyJogToTrace"

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

  private getBaseOffsets() {
    return this.overlappingTraceSegments.map((_, idx) => {
      const n = Math.floor(idx / 2) + 1
      const signed = idx % 2 === 0 ? -n : n
      return signed * this.SHIFT_DISTANCE
    })
  }

  private getOffsetCandidates() {
    const baseOffsets = this.getBaseOffsets()

    return [baseOffsets, baseOffsets.map((offset) => -offset)]
  }

  private buildCorrectedTraceMap(offsets: number[]) {
    const correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}

    for (const group of this.overlappingTraceSegments) {
      for (const { solvedTracePathIndex } of group.pathsWithOverlap) {
        const trace =
          this.traceNetIslands[group.connNetId][solvedTracePathIndex]
        if (trace) correctedTraceMap[trace.mspPairId] = trace
      }
    }

    const EPS = 1e-6

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
        const current = correctedTraceMap[original.mspPairId] ?? original
        const pts = current.tracePath.map((p) => ({ ...p }))

        const segIdxs = Array.from(segIdxSet).sort((a, b) => a - b)

        const segIdxsRev = Array.from(segIdxSet)
          .sort((a, b) => a - b)
          .reverse()

        const JOG_SIZE = this.SHIFT_DISTANCE

        // Process from end to start to keep indices valid after splicing
        for (const si of segIdxsRev) {
          if (si < 0 || si >= pts.length - 1) continue

          if (si === 0 || si === pts.length - 2) {
            applyJogToTerminalSegment({
              pts,
              segmentIndex: si,
              offset,
              JOG_SIZE,
              EPS,
            })
          } else {
            // Internal segment - shift both points
            const start = pts[si]!
            const end = pts[si + 1]!
            const isVertical = Math.abs(start.x - end.x) < EPS
            const isHorizontal = Math.abs(start.y - end.y) < EPS
            if (!isVertical && !isHorizontal) continue

            if (isVertical) {
              start.x += offset
              end.x += offset
            } else {
              // Horizontal
              start.y += offset
              end.y += offset
            }
          }
        }

        // Remove consecutive duplicate points that might appear after shifts
        const cleaned: typeof pts = []
        for (const p of pts) {
          if (
            cleaned.length === 0 ||
            !samePoint(cleaned[cleaned.length - 1], p)
          ) {
            cleaned.push(p)
          }
        }

        correctedTraceMap[original.mspPairId] = {
          ...current,
          tracePath: cleaned,
        }
      }
    })

    return correctedTraceMap
  }

  private getAllTracePaths(
    correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath>,
  ) {
    const allTracePaths: SolvedTracePath[] = []
    const seen = new Set<MspConnectionPairId>()

    for (const traces of Object.values(this.traceNetIslands)) {
      for (const trace of traces) {
        const corrected = correctedTraceMap[trace.mspPairId] ?? trace
        if (seen.has(corrected.mspPairId)) continue
        seen.add(corrected.mspPairId)
        allTracePaths.push(corrected)
      }
    }

    return allTracePaths
  }

  private countTraceCrossings(
    correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath>,
  ) {
    const EPS = 1e-6
    const traces = this.getAllTracePaths(correctedTraceMap)
    let crossingCount = 0

    const rangeContains = (value: number, a: number, b: number) =>
      value > Math.min(a, b) + EPS && value < Math.max(a, b) - EPS

    const rangeTouches = (value: number, a: number, b: number) =>
      value >= Math.min(a, b) - EPS && value <= Math.max(a, b) + EPS

    for (let ti = 0; ti < traces.length; ti++) {
      for (let tj = ti + 1; tj < traces.length; tj++) {
        const traceA = traces[ti]!
        const traceB = traces[tj]!
        if (traceA.globalConnNetId === traceB.globalConnNetId) continue

        for (let ai = 0; ai < traceA.tracePath.length - 1; ai++) {
          const a1 = traceA.tracePath[ai]!
          const a2 = traceA.tracePath[ai + 1]!
          const aVertical = Math.abs(a1.x - a2.x) < EPS
          const aHorizontal = Math.abs(a1.y - a2.y) < EPS
          if (!aVertical && !aHorizontal) continue

          for (let bi = 0; bi < traceB.tracePath.length - 1; bi++) {
            const b1 = traceB.tracePath[bi]!
            const b2 = traceB.tracePath[bi + 1]!
            const bVertical = Math.abs(b1.x - b2.x) < EPS
            const bHorizontal = Math.abs(b1.y - b2.y) < EPS
            if (!bVertical && !bHorizontal) continue
            if (aVertical === bVertical) continue

            const vertical = aVertical
              ? { x: a1.x, y1: a1.y, y2: a2.y }
              : { x: b1.x, y1: b1.y, y2: b2.y }
            const horizontal = aHorizontal
              ? { y: a1.y, x1: a1.x, x2: a2.x }
              : { y: b1.y, x1: b1.x, x2: b2.x }

            const crossesInterior =
              rangeTouches(vertical.x, horizontal.x1, horizontal.x2) &&
              rangeTouches(horizontal.y, vertical.y1, vertical.y2) &&
              (rangeContains(vertical.x, horizontal.x1, horizontal.x2) ||
                rangeContains(horizontal.y, vertical.y1, vertical.y2))

            if (crossesInterior) crossingCount++
          }
        }
      }
    }

    return crossingCount
  }

  private chooseBestCorrectedTraceMap() {
    const candidates = this.getOffsetCandidates().map((offsets) => {
      const correctedTraceMap = this.buildCorrectedTraceMap(offsets)
      return {
        correctedTraceMap,
        crossingCount: this.countTraceCrossings(correctedTraceMap),
      }
    })

    candidates.sort((a, b) => a.crossingCount - b.crossingCount)

    return candidates[0]!.correctedTraceMap
  }

  override _step() {
    // Shift the overlapping segments in the direction that produces the fewest
    // crossings against the surrounding trace geometry.
    this.correctedTraceMap = this.chooseBestCorrectedTraceMap()
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
