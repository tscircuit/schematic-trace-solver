/**
 * TraceMergerSolver - Merges same-net trace lines that are close together
 *
 * Issue #34: When traces belong to the same net and have segments that are
 * close together (nearly parallel, same X or Y), they should be merged
 * to create cleaner schematic layouts.
 */

import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"

type ConnNetId = string

interface TraceSegment {
  start: Point
  end: Point
  traceIndex: number
  segmentIndex: number
  isVertical: boolean
  isHorizontal: boolean
}

interface MergeCandidate {
  segment1: TraceSegment
  segment2: TraceSegment
  distance: number
  mergedPosition: number // The X (for vertical) or Y (for horizontal) position to merge to
}

export interface TraceMergerSolverParams {
  inputProblem: InputProblem
  inputTracePaths: Array<SolvedTracePath>
}

export class TraceMergerSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: Array<SolvedTracePath>

  /**
   * Traces grouped by their global connection net id
   */
  tracesByNet: Record<ConnNetId, Array<SolvedTracePath>> = {}

  /**
   * Output traces after merging
   */
  mergedTracePaths: Array<SolvedTracePath> = []

  /**
   * Threshold for considering segments as "close together"
   */
  static readonly MERGE_THRESHOLD = 0.15

  /**
   * Epsilon for floating point comparisons
   */
  static readonly EPS = 1e-6

  constructor(params: TraceMergerSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.inputTracePaths

    // Group traces by net
    this.tracesByNet = this.groupTracesByNet()

    // Start with a copy of input traces
    this.mergedTracePaths = structuredClone(this.inputTracePaths)
  }

  override getConstructorParams(): ConstructorParameters<
    typeof TraceMergerSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTracePaths: this.inputTracePaths,
    }
  }

  /**
   * Group traces by their global connection net id
   */
  private groupTracesByNet(): Record<ConnNetId, Array<SolvedTracePath>> {
    const groups: Record<ConnNetId, Array<SolvedTracePath>> = {}

    for (const trace of this.inputTracePaths) {
      const netId = trace.globalConnNetId
      if (!groups[netId]) {
        groups[netId] = []
      }
      groups[netId].push(trace)
    }

    return groups
  }

  /**
   * Extract all segments from a trace path
   */
  private getSegments(tracePath: Point[], traceIndex: number): TraceSegment[] {
    const segments: TraceSegment[] = []
    const EPS = TraceMergerSolver.EPS

    for (let i = 0; i < tracePath.length - 1; i++) {
      const start = tracePath[i]!
      const end = tracePath[i + 1]!

      const isVertical = Math.abs(start.x - end.x) < EPS
      const isHorizontal = Math.abs(start.y - end.y) < EPS

      segments.push({
        start,
        end,
        traceIndex,
        segmentIndex: i,
        isVertical,
        isHorizontal,
      })
    }

    return segments
  }

  /**
   * Find segments from the same net that are close and can be merged
   */
  private findMergeCandidates(traces: SolvedTracePath[]): MergeCandidate[] {
    const candidates: MergeCandidate[] = []
    const EPS = TraceMergerSolver.EPS
    const THRESHOLD = TraceMergerSolver.MERGE_THRESHOLD

    // Get all segments from all traces
    const allSegments: TraceSegment[] = []
    for (let i = 0; i < traces.length; i++) {
      const segments = this.getSegments(traces[i]!.tracePath, i)
      allSegments.push(...segments)
    }

    // Compare each pair of segments
    for (let i = 0; i < allSegments.length; i++) {
      for (let j = i + 1; j < allSegments.length; j++) {
        const seg1 = allSegments[i]!
        const seg2 = allSegments[j]!

        // Skip if from the same trace (they're already connected)
        if (seg1.traceIndex === seg2.traceIndex) continue

        // Check if both are vertical or both are horizontal
        if (seg1.isVertical && seg2.isVertical) {
          // For vertical segments, check if X values are close
          const xDiff = Math.abs(seg1.start.x - seg2.start.x)
          if (xDiff > EPS && xDiff < THRESHOLD) {
            // Check if Y ranges overlap
            if (
              this.rangesOverlap(
                seg1.start.y,
                seg1.end.y,
                seg2.start.y,
                seg2.end.y,
              )
            ) {
              // Merge to average X position
              const mergedX = (seg1.start.x + seg2.start.x) / 2
              candidates.push({
                segment1: seg1,
                segment2: seg2,
                distance: xDiff,
                mergedPosition: mergedX,
              })
            }
          }
        } else if (seg1.isHorizontal && seg2.isHorizontal) {
          // For horizontal segments, check if Y values are close
          const yDiff = Math.abs(seg1.start.y - seg2.start.y)
          if (yDiff > EPS && yDiff < THRESHOLD) {
            // Check if X ranges overlap
            if (
              this.rangesOverlap(
                seg1.start.x,
                seg1.end.x,
                seg2.start.x,
                seg2.end.x,
              )
            ) {
              // Merge to average Y position
              const mergedY = (seg1.start.y + seg2.start.y) / 2
              candidates.push({
                segment1: seg1,
                segment2: seg2,
                distance: yDiff,
                mergedPosition: mergedY,
              })
            }
          }
        }
      }
    }

    // Sort by distance (merge closest ones first)
    candidates.sort((a, b) => a.distance - b.distance)

    return candidates
  }

  /**
   * Check if two 1D ranges overlap
   */
  private rangesOverlap(
    a1: number,
    a2: number,
    b1: number,
    b2: number,
  ): boolean {
    const minA = Math.min(a1, a2)
    const maxA = Math.max(a1, a2)
    const minB = Math.min(b1, b2)
    const maxB = Math.max(b1, b2)
    return Math.min(maxA, maxB) > Math.max(minA, minB)
  }

  /**
   * Apply a merge by adjusting segment positions
   */
  private applyMerge(
    traces: SolvedTracePath[],
    candidate: MergeCandidate,
  ): void {
    const { segment1, segment2, mergedPosition } = candidate

    // Get the trace paths
    const path1 = traces[segment1.traceIndex]!.tracePath
    const path2 = traces[segment2.traceIndex]!.tracePath

    if (segment1.isVertical) {
      // Adjust X coordinates
      path1[segment1.segmentIndex]!.x = mergedPosition
      path1[segment1.segmentIndex + 1]!.x = mergedPosition

      path2[segment2.segmentIndex]!.x = mergedPosition
      path2[segment2.segmentIndex + 1]!.x = mergedPosition
    } else {
      // Adjust Y coordinates
      path1[segment1.segmentIndex]!.y = mergedPosition
      path1[segment1.segmentIndex + 1]!.y = mergedPosition

      path2[segment2.segmentIndex]!.y = mergedPosition
      path2[segment2.segmentIndex + 1]!.y = mergedPosition
    }
  }

  override _step() {
    // Process each net group
    let mergesApplied = false

    for (const netId of Object.keys(this.tracesByNet)) {
      const netTraces = this.tracesByNet[netId]!

      // Skip if only one trace in this net
      if (netTraces.length < 2) continue

      // Find merge candidates
      const candidates = this.findMergeCandidates(netTraces)

      // Apply the first merge candidate (if any)
      if (candidates.length > 0) {
        const candidate = candidates[0]!
        this.applyMerge(netTraces, candidate)
        mergesApplied = true

        // Update merged trace paths
        for (const trace of netTraces) {
          const idx = this.mergedTracePaths.findIndex(
            (t) => t.mspPairId === trace.mspPairId,
          )
          if (idx !== -1) {
            this.mergedTracePaths[idx] = trace
          }
        }

        // Re-check for more merges in next iteration
        return
      }
    }

    // If no merges were applied, we're done
    if (!mergesApplied) {
      this.solved = true
    }
  }

  /**
   * Get the output traces
   */
  getOutput(): { traces: SolvedTracePath[] } {
    return {
      traces: this.mergedTracePaths,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)
    graphics.lines = graphics.lines || []

    // Draw merged traces
    for (const trace of this.mergedTracePaths) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    return graphics
  }
}
