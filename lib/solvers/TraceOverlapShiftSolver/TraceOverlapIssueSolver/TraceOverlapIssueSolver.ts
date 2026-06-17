import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { findFirstCollision } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { applyJogToTerminalSegment } from "./applyJogToTrace"

type ConnNetId = string

const EPS = 1e-6

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
  obstacleRects: ReturnType<typeof getObstacleRects>

  SHIFT_DISTANCE = 0.1

  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}

  constructor(params: {
    inputProblem: InputProblem
    overlappingTraceSegments: OverlappingTraceSegmentLocator[]
    traceNetIslands: Record<ConnNetId, Array<SolvedTracePath>>
  }) {
    super()
    this.overlappingTraceSegments = params.overlappingTraceSegments
    this.traceNetIslands = params.traceNetIslands
    this.obstacleRects = getObstacleRects(params.inputProblem)

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
    // Groups containing a straight pin-to-pin trace (2 points, both endpoints
    // are pins) keep their position when another group can shift instead:
    // shifting such a trace would force jogs on an otherwise straight line.
    const containsStraightPinToPinTrace = (
      group: OverlappingTraceSegmentLocator,
    ) =>
      group.pathsWithOverlap.some(({ solvedTracePathIndex }) => {
        const path =
          this.traceNetIslands[group.connNetId][solvedTracePathIndex]!
        return path.tracePath.length === 2
      })

    const groupShouldStayInPlace = this.overlappingTraceSegments.map(
      containsStraightPinToPinTrace,
    )
    const someGroupCanShift = groupShouldStayInPlace.some(
      (shouldStay) => !shouldStay,
    )

    // Compute offsets for each island involved: alternate directions
    const offsets = this.overlappingTraceSegments.map((group, idx) => {
      if (someGroupCanShift && groupShouldStayInPlace[idx]) return 0
      const n = Math.floor(idx / 2) + 1
      const signed = idx % 2 === 0 ? -n : n
      return this.getObstacleAwareOffset({
        group,
        offset: signed * this.SHIFT_DISTANCE,
      })
    })

    const eq = (a: number, b: number) => Math.abs(a - b) < EPS
    const samePoint = (
      p: { x: number; y: number } | undefined,
      q: { x: number; y: number } | undefined,
    ) => !!p && !!q && eq(p.x, q.x) && eq(p.y, q.y)

    // For each net island group, shift only its overlapping segments and adjust adjacent joints
    this.overlappingTraceSegments.forEach((group, gidx) => {
      const offset = offsets[gidx]!
      if (offset === 0) return

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

        this.correctedTraceMap[original.mspPairId] = {
          ...current,
          tracePath: cleaned,
        }
      }
    })

    this.solved = true
  }

  private getObstacleAwareOffset({
    group,
    offset,
  }: {
    group: OverlappingTraceSegmentLocator
    offset: number
  }) {
    const blockingCollisions = this.getBlockingCollisions({ group, offset })
    if (blockingCollisions.length === 0) return offset

    const crossesThroughObstacle = (candidateOffset: number) =>
      blockingCollisions.some(({ start, isVertical, obstacle }) => {
        let orig: number
        let min: number
        let max: number
        if (isVertical) {
          orig = start.x
          min = obstacle.minX
          max = obstacle.maxX
        } else {
          orig = start.y
          min = obstacle.minY
          max = obstacle.maxY
        }
        const next = orig + candidateOffset
        return (
          (orig <= min + EPS && next >= max - EPS) ||
          (orig >= max - EPS && next <= min + EPS)
        )
      })

    const edges = blockingCollisions.map(({ start, isVertical, obstacle }) => {
      if (isVertical) {
        return {
          coord: start.x,
          lowEdge: obstacle.minX,
          highEdge: obstacle.maxX,
        }
      }
      return { coord: start.y, lowEdge: obstacle.minY, highEdge: obstacle.maxY }
    })

    const bestCandidate = (clearance: number) => {
      const candidates = edges.flatMap(({ coord, lowEdge, highEdge }) => [
        lowEdge - coord - clearance,
        highEdge - coord + clearance,
      ])
      return candidates
        .filter((candidateOffset) => !crossesThroughObstacle(candidateOffset))
        .filter(
          (candidateOffset) =>
            this.getBlockingCollisions({ group, offset: candidateOffset })
              .length === 0,
        )
        .sort((a, b) => Math.abs(a - offset) - Math.abs(b - offset))[0]
    }

    const EDGE_MARGIN = this.SHIFT_DISTANCE / 10
    return (
      bestCandidate(this.SHIFT_DISTANCE) ?? bestCandidate(EDGE_MARGIN) ?? offset
    )
  }

  private getBlockingCollisions({
    group,
    offset,
  }: {
    group: OverlappingTraceSegmentLocator
    offset: number
  }) {
    const blockingCollisions: Array<{
      start: SolvedTracePath["tracePath"][number]
      isVertical: boolean
      obstacle: ReturnType<typeof getObstacleRects>[number]
    }> = []

    for (const {
      solvedTracePathIndex,
      traceSegmentIndex,
    } of group.pathsWithOverlap) {
      const trace = this.traceNetIslands[group.connNetId][solvedTracePathIndex]!
      const start = trace.tracePath[traceSegmentIndex]
      const end = trace.tracePath[traceSegmentIndex + 1]
      if (!start || !end) continue

      const isVertical = Math.abs(start.x - end.x) < EPS
      const isHorizontal = Math.abs(start.y - end.y) < EPS
      if (!isVertical && !isHorizontal) continue

      const shiftedSegment = isVertical
        ? [
            { ...start, x: start.x + offset },
            { ...end, x: end.x + offset },
          ]
        : [
            { ...start, y: start.y + offset },
            { ...end, y: end.y + offset },
          ]
      const collision = findFirstCollision(shiftedSegment, this.obstacleRects)
      if (collision) {
        blockingCollisions.push({
          start,
          isVertical,
          obstacle: collision.rect,
        })
      }
    }

    return blockingCollisions
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
