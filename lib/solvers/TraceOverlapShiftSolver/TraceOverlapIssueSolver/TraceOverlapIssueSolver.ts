import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { applyJogToTerminalSegment } from "./applyJogToTrace"

type ConnNetId = string
type Point = SolvedTracePath["tracePath"][number]
type CorrectedTraceMap = Record<MspConnectionPairId, SolvedTracePath>

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
      for (const { solvedTracePathIndex } of pathsWithOverlap) {
        const mspPairId =
          this.traceNetIslands[connNetId][solvedTracePathIndex].mspPairId
        this.correctedTraceMap[mspPairId] =
          this.traceNetIslands[connNetId][solvedTracePathIndex]
      }
    }
  }

  override _step() {
    let bestTraceMap: CorrectedTraceMap | null = null
    let bestScore = Number.POSITIVE_INFINITY

    for (const offsets of this.getOffsetCandidates()) {
      const candidateTraceMap = this.buildCorrectedTraceMapForOffsets(offsets)
      const candidateScore = this.countCrossNetIntersections(candidateTraceMap)
      if (candidateScore < bestScore) {
        bestScore = candidateScore
        bestTraceMap = candidateTraceMap
      }
    }

    this.correctedTraceMap = bestTraceMap ?? this.correctedTraceMap
    this.solved = true
  }

  private getOffsetCandidates() {
    const baseOffsets = this.overlappingTraceSegments.map((_, idx) => {
      const n = Math.floor(idx / 2) + 1
      const signed = idx % 2 === 0 ? -n : n
      return signed * this.SHIFT_DISTANCE
    })

    if (baseOffsets.length <= 1) {
      return [baseOffsets]
    }

    const reversedOffsets = baseOffsets.map((offset) => -offset)
    return [baseOffsets, reversedOffsets]
  }

  private buildCorrectedTraceMapForOffsets(offsets: number[]) {
    // Shift only the overlapping segments, and move the shared endpoints
    // (the last point of the previous segment and the first point of the next
    // segment) so the polyline remains orthogonal without self-overlap.
    const EPS = 1e-6

    const eq = (a: number, b: number) => Math.abs(a - b) < EPS
    const samePoint = (
      p: { x: number; y: number } | undefined,
      q: { x: number; y: number } | undefined,
    ) => !!p && !!q && eq(p.x, q.x) && eq(p.y, q.y)

    const correctedTraceMap: CorrectedTraceMap = {}
    for (const { connNetId, pathsWithOverlap } of this
      .overlappingTraceSegments) {
      for (const { solvedTracePathIndex } of pathsWithOverlap) {
        const trace = this.traceNetIslands[connNetId][solvedTracePathIndex]
        if (!trace) continue
        correctedTraceMap[trace.mspPairId] = trace
      }
    }

    // For each net island group, shift only its overlapping segments and adjust adjacent joints
    for (let gidx = 0; gidx < this.overlappingTraceSegments.length; gidx++) {
      const group = this.overlappingTraceSegments[gidx]!
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
    }

    return correctedTraceMap
  }

  private getAllTracesWithCorrections(correctedTraceMap: CorrectedTraceMap) {
    const traces: SolvedTracePath[] = []

    for (const island of Object.values(this.traceNetIslands)) {
      for (const trace of island) {
        traces.push(correctedTraceMap[trace.mspPairId] ?? trace)
      }
    }

    return traces
  }

  private countCrossNetIntersections(correctedTraceMap: CorrectedTraceMap) {
    const traces = this.getAllTracesWithCorrections(correctedTraceMap)
    let count = 0

    for (let i = 0; i < traces.length; i++) {
      const traceA = traces[i]!
      for (let j = i + 1; j < traces.length; j++) {
        const traceB = traces[j]!
        if (traceA.globalConnNetId === traceB.globalConnNetId) continue
        count += countPathIntersections(traceA.tracePath, traceB.tracePath)
      }
    }

    return count
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

const countPathIntersections = (pathA: Point[], pathB: Point[]) => {
  let count = 0

  for (let i = 0; i < pathA.length - 1; i++) {
    for (let j = 0; j < pathB.length - 1; j++) {
      if (
        segmentsIntersect(pathA[i]!, pathA[i + 1]!, pathB[j]!, pathB[j + 1]!)
      ) {
        count++
      }
    }
  }

  return count
}

const segmentsIntersect = (a1: Point, a2: Point, b1: Point, b2: Point) => {
  const EPS = 1e-6
  const aVertical = Math.abs(a1.x - a2.x) < EPS
  const aHorizontal = Math.abs(a1.y - a2.y) < EPS
  const bVertical = Math.abs(b1.x - b2.x) < EPS
  const bHorizontal = Math.abs(b1.y - b2.y) < EPS

  if ((!aVertical && !aHorizontal) || (!bVertical && !bHorizontal)) {
    return false
  }

  const between = (value: number, p1: number, p2: number) =>
    value >= Math.min(p1, p2) - EPS && value <= Math.max(p1, p2) + EPS

  if (aVertical && bVertical) {
    if (Math.abs(a1.x - b1.x) > EPS) return false
    const overlap =
      Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) -
      Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y))
    return overlap > EPS
  }

  if (aHorizontal && bHorizontal) {
    if (Math.abs(a1.y - b1.y) > EPS) return false
    const overlap =
      Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) -
      Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x))
    return overlap > EPS
  }

  const verticalStart = aVertical ? a1 : b1
  const verticalEnd = aVertical ? a2 : b2
  const horizontalStart = aHorizontal ? a1 : b1
  const horizontalEnd = aHorizontal ? a2 : b2

  return (
    between(verticalStart.x, horizontalStart.x, horizontalEnd.x) &&
    between(horizontalStart.y, verticalStart.y, verticalEnd.y)
  )
}
