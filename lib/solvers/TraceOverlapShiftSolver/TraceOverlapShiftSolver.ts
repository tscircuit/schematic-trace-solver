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
import { isOrthogonalPath } from "lib/utils/isOrthogonalPath"

type ConnNetId = string

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

  override _step() {
    if (this.activeSubSolver?.solved) {
      for (const [mspPairId, newTrace] of Object.entries(
        this.activeSubSolver.correctedTraceMap,
      )) {
        if (isOrthogonalPath(newTrace.tracePath)) {
          this.correctedTraceMap[mspPairId] = newTrace
        }
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

    // Draw current corrected traces
    for (const trace of Object.values(this.correctedTraceMap)) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    return graphics
  }
}
