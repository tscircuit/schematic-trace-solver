import { doSegmentsIntersect } from "@tscircuit/math-utils"
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

export type TraceInteractionKind = "overlap" | "point_contact"

export class TraceOverlapIssueSolver extends BaseSolver {
  overlappingTraceSegments: OverlappingTraceSegmentLocator[]
  interactionKind: TraceInteractionKind
  traceNetIslands: Record<ConnNetId, Array<SolvedTracePath>>
  obstacleRects: ReturnType<typeof getObstacleRects>

  SHIFT_DISTANCE = 0.1

  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}

  constructor(params: {
    inputProblem: InputProblem
    overlappingTraceSegments: OverlappingTraceSegmentLocator[]
    interactionKind: TraceInteractionKind
    traceNetIslands: Record<ConnNetId, Array<SolvedTracePath>>
  }) {
    super()
    this.overlappingTraceSegments = params.overlappingTraceSegments
    this.interactionKind = params.interactionKind
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

    const getSeparationOffsets = (firstDirection: number) =>
      this.overlappingTraceSegments.map((group, groupIndex) => {
        if (someGroupCanShift && groupShouldStayInPlace[groupIndex]) return 0
        const n = Math.floor(groupIndex / 2) + 1
        const direction =
          groupIndex % 2 === 0 ? firstDirection : -firstDirection
        return this.getObstacleAwareOffset({
          group,
          offset: direction * n * this.SHIFT_DISTANCE,
        })
      })

    const establishedOffsets = getSeparationOffsets(-1)
    const isCompoundOverlap =
      this.interactionKind === "overlap" &&
      this.overlappingTraceSegments.some(
        (group) => group.pathsWithOverlap.length > 1,
      )

    // A compound overlap moves multiple rails as one correction. Preserve the
    // established deterministic separation because a single candidate score
    // cannot attribute downstream intersections to one participating rail.
    if (isCompoundOverlap) {
      this.correctedTraceMap = this.applyOffsets(establishedOffsets)
      this.solved = true
      return
    }

    const offsetCandidates: number[][] =
      this.interactionKind === "overlap"
        ? [establishedOffsets, getSeparationOffsets(1)]
        : []

    if (this.interactionKind === "point_contact") {
      // A point contact needs only one island to move. Try later islands first
      // so an established earlier trace remains stable when scores are equal.
      const movableGroupIndexes = this.overlappingTraceSegments
        .map((_, groupIndex) => groupIndex)
        .filter(
          (groupIndex) =>
            !someGroupCanShift || !groupShouldStayInPlace[groupIndex],
        )
        .reverse()
      for (const groupIndex of movableGroupIndexes) {
        const group = this.overlappingTraceSegments[groupIndex]!
        for (const direction of [-1, 1]) {
          const offsets = this.overlappingTraceSegments.map(() => 0)
          offsets[groupIndex] = this.getObstacleAwareOffset({
            group,
            offset: direction * this.SHIFT_DISTANCE,
          })
          offsetCandidates.push(offsets)
        }
      }
    }

    const candidates = offsetCandidates.map((offsets) => {
      const correctedTraceMap = this.applyOffsets(offsets)
      return {
        correctedTraceMap,
        intersectionCount:
          this.countDifferentNetIntersections(correctedTraceMap),
        totalDisplacement: offsets.reduce(
          (total, offset) => total + Math.abs(offset),
          0,
        ),
      }
    })

    candidates.sort(
      (a, b) =>
        a.intersectionCount - b.intersectionCount ||
        a.totalDisplacement - b.totalDisplacement,
    )
    this.correctedTraceMap = candidates[0]!.correctedTraceMap
    this.solved = true
  }

  private applyOffsets(offsets: number[]) {
    const correctedTraceMap = { ...this.correctedTraceMap }

    const eq = (a: number, b: number) => Math.abs(a - b) < EPS
    const samePoint = (
      p: { x: number; y: number } | undefined,
      q: { x: number; y: number } | undefined,
    ) => !!p && !!q && eq(p.x, q.x) && eq(p.y, q.y)

    // For each net island group, shift only its overlapping segments and adjust adjacent joints
    this.overlappingTraceSegments.forEach((group, groupIndex) => {
      const offset = offsets[groupIndex]!
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
        const current = correctedTraceMap[original.mspPairId] ?? original
        const pts = current.tracePath.map((p) => ({ ...p }))

        const segIdxsRev = Array.from(segIdxSet)
          .sort((a, b) => a - b)
          .reverse()
        const segmentAxes = new Map<number, "vertical" | "horizontal">()
        for (const si of segIdxsRev) {
          const start = pts[si]
          const end = pts[si + 1]
          if (!start || !end) continue
          if (Math.abs(start.x - end.x) < EPS) {
            segmentAxes.set(si, "vertical")
          } else if (Math.abs(start.y - end.y) < EPS) {
            segmentAxes.set(si, "horizontal")
          }
        }
        const shiftedXPointIndexes = new Set<number>()
        const shiftedYPointIndexes = new Set<number>()

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
            const axis = segmentAxes.get(si)

            if (axis === "vertical") {
              if (!shiftedXPointIndexes.has(si)) {
                start.x += offset
                shiftedXPointIndexes.add(si)
              }
              if (!shiftedXPointIndexes.has(si + 1)) {
                end.x += offset
                shiftedXPointIndexes.add(si + 1)
              }
            } else if (axis === "horizontal") {
              if (!shiftedYPointIndexes.has(si)) {
                start.y += offset
                shiftedYPointIndexes.add(si)
              }
              if (!shiftedYPointIndexes.has(si + 1)) {
                end.y += offset
                shiftedYPointIndexes.add(si + 1)
              }
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

  private countDifferentNetIntersections(
    correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath>,
  ) {
    const traces = Object.values(this.traceNetIslands).flatMap((island) =>
      island.map((trace) => correctedTraceMap[trace.mspPairId] ?? trace),
    )
    let intersectionCount = 0

    for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
      const trace = traces[traceIndex]!
      for (
        let otherTraceIndex = traceIndex + 1;
        otherTraceIndex < traces.length;
        otherTraceIndex++
      ) {
        const otherTrace = traces[otherTraceIndex]!
        if (trace.globalConnNetId === otherTrace.globalConnNetId) continue

        for (
          let segmentIndex = 0;
          segmentIndex < trace.tracePath.length - 1;
          segmentIndex++
        ) {
          for (
            let otherSegmentIndex = 0;
            otherSegmentIndex < otherTrace.tracePath.length - 1;
            otherSegmentIndex++
          ) {
            if (
              doSegmentsIntersect(
                trace.tracePath[segmentIndex]!,
                trace.tracePath[segmentIndex + 1]!,
                otherTrace.tracePath[otherSegmentIndex]!,
                otherTrace.tracePath[otherSegmentIndex + 1]!,
              )
            ) {
              intersectionCount++
            }
          }
        }
      }
    }

    return intersectionCount
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
