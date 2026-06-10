import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { ConnectivityMap } from "connectivity-map"
import {
  TraceOverlapIssueSolver,
  type OverlappingTraceSegmentLocator,
} from "./TraceOverlapIssueSolver/TraceOverlapIssueSolver"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import type { Point } from "@tscircuit/math-utils"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"

type ConnNetId = string
type SegmentOrientation = "vertical" | "horizontal"

interface TraceSegmentRef {
  connNetId: ConnNetId
  pathIndex: number
  trace: SolvedTracePath
  traceSegmentIndex: number
  orientation: SegmentOrientation
  coord: number
  min: number
  max: number
  length: number
  isTerminal: boolean
}

/**
 * This solver finds traces that overlap (coincident and parallel) and aren't
 * connected via the globalConnMap, then shifts them to avoid the overlap in
 * such a way that minimizes the resulting intersections
 *
 * All traces are orthogonal, so for traces to be considered overlapping, they
 * need to each have a segment where both are horizontal or both are vertical
 * AND the segments must be within 1e-6 of each other in X (if vertical) or
 * Y (if horizontal)
 *
 * Each iteration, we find overlapping traces that aren't part of the same net.
 * This is the same as finding two "trace net islands" that have an overlap.
 *
 * We then consider all the possible ways to shift the overlapping traces to
 * minimize the intersections. If there are multiple trace segments within the
 * same net island they shift together.
 */
export class TraceOverlapShiftSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: Array<SolvedTracePath>
  globalConnMap: ConnectivityMap

  declare activeSubSolver: TraceOverlapIssueSolver | null

  /**
   * A traceNetIsland is a set of traces that are connected via the globalConnMap
   */
  traceNetIslands: Record<ConnNetId, Array<SolvedTracePath>> = {}

  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}

  cleanupPhase: "same_net_alignment" | "diagonals" | "done" | null = null

  constructor(params: {
    inputProblem: InputProblem
    inputTracePaths: Array<SolvedTracePath>
    globalConnMap: ConnectivityMap
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.inputTracePaths
    this.globalConnMap = params.globalConnMap

    for (const tracePath of this.inputTracePaths) {
      const { mspPairId } = tracePath
      this.correctedTraceMap[mspPairId] = tracePath
    }

    this.traceNetIslands = this.computeTraceNetIslands()
  }

  override getConstructorParams(): ConstructorParameters<
    typeof TraceOverlapShiftSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTracePaths: this.inputTracePaths,
      globalConnMap: this.globalConnMap,
    }
  }

  computeTraceNetIslands(): Record<ConnNetId, Array<SolvedTracePath>> {
    // Build islands keyed by global connection net id.
    // Preserve stable order by iterating original inputTracePaths array.
    const islands: Record<ConnNetId, Array<SolvedTracePath>> = {}

    for (const original of this.inputTracePaths) {
      const path = this.correctedTraceMap[original.mspPairId] ?? original
      const key: ConnNetId = path.globalConnNetId
      if (!islands[key]) islands[key] = []
      islands[key].push(path)
    }

    return islands
  }

  findNextOverlapIssue(): {
    overlappingTraceSegments: Array<OverlappingTraceSegmentLocator>
  } | null {
    // Detect the next set of overlapping segments between two different net islands.
    const EPS = 2e-3

    const netIds = Object.keys(this.traceNetIslands)
    // Compare each pair of different nets
    for (let i = 0; i < netIds.length; i++) {
      for (let j = i + 1; j < netIds.length; j++) {
        const netA = netIds[i]!
        const netB = netIds[j]!
        const pathsA = this.traceNetIslands[netA] || []
        const pathsB = this.traceNetIslands[netB] || []

        // Collect overlaps for this pair
        const overlapsA: Array<{
          solvedTracePathIndex: number
          traceSegmentIndex: number
        }> = []
        const overlapsB: Array<{
          solvedTracePathIndex: number
          traceSegmentIndex: number
        }> = []

        // Track to avoid duplicates
        const seenA = new Set<string>()
        const seenB = new Set<string>()

        const overlaps1D = (
          a1: number,
          a2: number,
          b1: number,
          b2: number,
        ): boolean => {
          const minA = Math.min(a1, a2)
          const maxA = Math.max(a1, a2)
          const minB = Math.min(b1, b2)
          const maxB = Math.max(b1, b2)
          const overlap = Math.min(maxA, maxB) - Math.max(minA, minB)
          return overlap > EPS
        }

        for (let pa = 0; pa < pathsA.length; pa++) {
          const pathA = pathsA[pa]!
          const ptsA = pathA.tracePath
          for (let sa = 0; sa < ptsA.length - 1; sa++) {
            const a1 = ptsA[sa]!
            const a2 = ptsA[sa + 1]!
            const aVert = Math.abs(a1.x - a2.x) < EPS
            const aHorz = Math.abs(a1.y - a2.y) < EPS
            if (!aVert && !aHorz) continue

            for (let pb = 0; pb < pathsB.length; pb++) {
              const pathB = pathsB[pb]!
              const ptsB = pathB.tracePath
              for (let sb = 0; sb < ptsB.length - 1; sb++) {
                const b1 = ptsB[sb]!
                const b2 = ptsB[sb + 1]!
                const bVert = Math.abs(b1.x - b2.x) < EPS
                const bHorz = Math.abs(b1.y - b2.y) < EPS
                if (!bVert && !bHorz) continue

                // Only consider colinear, parallel orientation overlaps
                if (aVert && bVert) {
                  if (Math.abs(a1.x - b1.x) < EPS) {
                    if (overlaps1D(a1.y, a2.y, b1.y, b2.y)) {
                      const keyA = `${pa}:${sa}`
                      const keyB = `${pb}:${sb}`
                      if (!seenA.has(keyA)) {
                        overlapsA.push({
                          solvedTracePathIndex: pa,
                          traceSegmentIndex: sa,
                        })
                        seenA.add(keyA)
                      }
                      if (!seenB.has(keyB)) {
                        overlapsB.push({
                          solvedTracePathIndex: pb,
                          traceSegmentIndex: sb,
                        })
                        seenB.add(keyB)
                      }
                    }
                  }
                } else if (aHorz && bHorz) {
                  if (Math.abs(a1.y - b1.y) < EPS) {
                    if (overlaps1D(a1.x, a2.x, b1.x, b2.x)) {
                      const keyA = `${pa}:${sa}`
                      const keyB = `${pb}:${sb}`
                      if (!seenA.has(keyA)) {
                        overlapsA.push({
                          solvedTracePathIndex: pa,
                          traceSegmentIndex: sa,
                        })
                        seenA.add(keyA)
                      }
                      if (!seenB.has(keyB)) {
                        overlapsB.push({
                          solvedTracePathIndex: pb,
                          traceSegmentIndex: sb,
                        })
                        seenB.add(keyB)
                      }
                    }
                  }
                }
              }
            }
          }
        }

        if (overlapsA.length > 0 && overlapsB.length > 0) {
          return {
            overlappingTraceSegments: [
              { connNetId: netA, pathsWithOverlap: overlapsA },
              { connNetId: netB, pathsWithOverlap: overlapsB },
            ],
          }
        }
      }
    }

    return null
  }

  private getTraceSegments({
    connNetId,
    pathIndex,
    trace,
  }: {
    connNetId: ConnNetId
    pathIndex: number
    trace: SolvedTracePath
  }): TraceSegmentRef[] {
    const EPS = 2e-3
    const segments: TraceSegmentRef[] = []
    const pts = trace.tracePath

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i]!
      const p2 = pts[i + 1]!
      const isVertical = Math.abs(p1.x - p2.x) < EPS
      const isHorizontal = Math.abs(p1.y - p2.y) < EPS
      if (!isVertical && !isHorizontal) continue

      const orientation: SegmentOrientation = isVertical
        ? "vertical"
        : "horizontal"
      const coord = isVertical ? p1.x : p1.y
      const a = isVertical ? p1.y : p1.x
      const b = isVertical ? p2.y : p2.x

      segments.push({
        connNetId,
        pathIndex,
        trace,
        traceSegmentIndex: i,
        orientation,
        coord,
        min: Math.min(a, b),
        max: Math.max(a, b),
        length: Math.abs(a - b),
        isTerminal: i === 0 || i === pts.length - 2,
      })
    }

    return segments
  }

  private getRangeOverlap(a: TraceSegmentRef, b: TraceSegmentRef): number {
    return Math.min(a.max, b.max) - Math.max(a.min, b.min)
  }

  private findNextSameNetAlignment(): {
    movingSegment: TraceSegmentRef
    targetCoord: number
  } | null {
    const EPS = 2e-3
    const SAME_NET_ALIGNMENT_DISTANCE = 0.12

    for (const [connNetId, traces] of Object.entries(this.traceNetIslands)) {
      const segments = traces.flatMap((trace, pathIndex) =>
        this.getTraceSegments({ connNetId, pathIndex, trace }),
      )

      for (let i = 0; i < segments.length; i++) {
        for (let j = i + 1; j < segments.length; j++) {
          const a = segments[i]!
          const b = segments[j]!

          if (a.trace.mspPairId === b.trace.mspPairId) continue
          if (a.orientation !== b.orientation) continue

          const coordDiff = Math.abs(a.coord - b.coord)
          if (coordDiff <= EPS) continue
          if (coordDiff > SAME_NET_ALIGNMENT_DISTANCE) continue
          if (this.getRangeOverlap(a, b) <= EPS) continue

          if (!a.isTerminal && b.isTerminal) {
            return { movingSegment: a, targetCoord: b.coord }
          }
          if (!b.isTerminal && a.isTerminal) {
            return { movingSegment: b, targetCoord: a.coord }
          }
          if (a.isTerminal && b.isTerminal) {
            continue
          }

          if (a.length < b.length) {
            return { movingSegment: a, targetCoord: b.coord }
          }
          return { movingSegment: b, targetCoord: a.coord }
        }
      }
    }

    return null
  }

  private removeConsecutiveDuplicatePoints(points: Point[]): Point[] {
    const EPS = 1e-9
    const cleaned: Point[] = []
    for (const point of points) {
      const previous = cleaned[cleaned.length - 1]
      if (
        !previous ||
        Math.abs(previous.x - point.x) > EPS ||
        Math.abs(previous.y - point.y) > EPS
      ) {
        cleaned.push(point)
      }
    }
    return cleaned
  }

  private alignTraceSegmentToCoordinate(
    segment: TraceSegmentRef,
    targetCoord: number,
  ): boolean {
    const EPS = 2e-3
    if (Math.abs(segment.coord - targetCoord) <= EPS) return false
    if (segment.isTerminal) return false

    const currentTrace =
      this.correctedTraceMap[segment.trace.mspPairId] ?? segment.trace
    const points = currentTrace.tracePath.map((point) => ({ ...point }))
    const start = points[segment.traceSegmentIndex]
    const end = points[segment.traceSegmentIndex + 1]
    if (!start || !end) return false

    if (segment.orientation === "vertical") {
      start.x = targetCoord
      end.x = targetCoord
    } else {
      start.y = targetCoord
      end.y = targetCoord
    }

    this.correctedTraceMap[currentTrace.mspPairId] = {
      ...currentTrace,
      tracePath: simplifyPath(this.removeConsecutiveDuplicatePoints(points)),
    }

    return true
  }

  private findAndFixNextSameNetAlignment(): boolean {
    const alignment = this.findNextSameNetAlignment()
    if (!alignment) return false

    return this.alignTraceSegmentToCoordinate(
      alignment.movingSegment,
      alignment.targetCoord,
    )
  }

  private findNextDiagonalSegment() {
    const EPS = 2e-3
    for (const mspPairId in this.correctedTraceMap) {
      const tracePath = this.correctedTraceMap[mspPairId]!.tracePath
      for (let i = 0; i < tracePath.length - 1; i++) {
        const p1 = tracePath[i]!
        const p2 = tracePath[i + 1]!

        const isHorizontal = Math.abs(p1.y - p2.y) < EPS
        const isVertical = Math.abs(p1.x - p2.x) < EPS

        if (!isHorizontal && !isVertical) {
          return { mspPairId, tracePath, i, p1, p2 }
        }
      }
    }
    return null
  }

  private findAndFixNextDiagonalSegment(): boolean {
    const diagonalInfo = this.findNextDiagonalSegment()

    if (!diagonalInfo) {
      return false // No diagonal segments found
    }

    const { mspPairId, tracePath, i, p1, p2 } = diagonalInfo
    const EPS = 2e-3

    const p0 = i > 0 ? tracePath[i - 1] : null
    const p3 = i + 2 < tracePath.length ? tracePath[i + 2] : null

    const prevIsVertical = p0 ? Math.abs(p0.x - p1.x) < EPS : false
    const prevIsHorizontal = p0 ? Math.abs(p0.y - p1.y) < EPS : false

    const nextIsVertical = p3 ? Math.abs(p2.x - p3.x) < EPS : false
    const nextIsHorizontal = p3 ? Math.abs(p2.y - p3.y) < EPS : false

    const elbow1 = { x: p1.x, y: p2.y } // vertical from p1
    const elbow2 = { x: p2.x, y: p1.y } // horizontal from p1

    let score1 = 0
    if (prevIsVertical) score1++
    if (nextIsHorizontal) score1++

    let score2 = 0
    if (prevIsHorizontal) score2++
    if (nextIsVertical) score2++

    const elbowPoint = score1 < score2 ? elbow1 : elbow2

    // Replace [p1, p2] with [p1, elbowPoint, p2]
    tracePath.splice(i + 1, 0, elbowPoint)
    return true // Fixed one diagonal, return true to re-evaluate in next step
  }

  override _step() {
    if (this.activeSubSolver?.solved) {
      for (const [mspPairId, newTrace] of Object.entries(
        this.activeSubSolver.correctedTraceMap,
      )) {
        this.correctedTraceMap[mspPairId] = newTrace
      }
      this.activeSubSolver = null
      this.traceNetIslands = this.computeTraceNetIslands()
    }

    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      return
    }

    // Find the next overlapping trace segment
    const overlapIssue = this.findNextOverlapIssue()

    if (overlapIssue === null) {
      if (this.cleanupPhase === null) {
        this.cleanupPhase = "same_net_alignment"
      }

      if (this.cleanupPhase === "same_net_alignment") {
        const fixedSameNetAlignment = this.findAndFixNextSameNetAlignment()
        if (fixedSameNetAlignment) {
          this.traceNetIslands = this.computeTraceNetIslands()
          this.cleanupPhase = null
          return
        }
        this.cleanupPhase = "diagonals"
      }

      if (this.cleanupPhase === "diagonals") {
        const fixedDiagonal = this.findAndFixNextDiagonalSegment()
        if (!fixedDiagonal) {
          this.cleanupPhase = "done"
          this.solved = true
        }
        return
      }
      // If cleanupPhase is "done", then the solver is truly solved.
      this.solved = true
      return
    }

    const { overlappingTraceSegments } = overlapIssue

    this.activeSubSolver = new TraceOverlapIssueSolver({
      overlappingTraceSegments,
      traceNetIslands: this.traceNetIslands,
    })
  }

  override visualize() {
    if (this.activeSubSolver) {
      return this.activeSubSolver.visualize()
    }

    const graphics = visualizeInputProblem(this.inputProblem)
    graphics.circles = graphics.circles || []

    // Draw current corrected traces
    for (const trace of Object.values(this.correctedTraceMap)) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    if (this.cleanupPhase === "diagonals") {
      const diagonalInfo = this.findNextDiagonalSegment()
      if (diagonalInfo) {
        graphics.lines!.push({
          points: [diagonalInfo.p1, diagonalInfo.p2],
          strokeColor: "red",
          strokeWidth: 0.05,
        })
      }
    }

    return graphics
  }
}
