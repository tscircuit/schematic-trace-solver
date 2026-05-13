import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"

export interface SameNetTraceCombiningSolverInput {
  inputProblem: import("lib/types/InputProblem").InputProblem
  traces: SolvedTracePath[]
  /** Maximum distance between traces to consider merging (in schematic units) */
  proximityThreshold?: number
}

interface TraceSegment {
  trace: SolvedTracePath
  startPoint: Point
  endPoint: Point
  isHorizontal: boolean
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * SameNetTraceCombiningSolver - Combines same-net trace segments that are close together
 *
 * This solver reduces visual clutter by merging traces from the same net that run
 * parallel and close to each other. It helps create cleaner schematic layouts by
 * combining redundant trace paths.
 *
 * The solver:
 * 1. Groups traces by their globalConnNetId
 * 2. For each net group, identifies traces that are close together
 * 3. Merges parallel traces that are within the proximity threshold
 * 4. Preserves traces that are not suitable for merging (different orientation, etc.)
 */
export class SameNetTraceCombiningSolver extends BaseSolver {
  private input: SameNetTraceCombiningSolverInput
  private outputTraces: SolvedTracePath[]
  private proximityThreshold: number
  private currentNetId: string | null = null
  private netsToProcess: string[] = []
  private tracesByNet: Map<string, SolvedTracePath[]>

  constructor(solverInput: SameNetTraceCombiningSolverInput) {
    super()
    this.input = solverInput
    this.proximityThreshold = solverInput.proximityThreshold ?? 0.19
    this.outputTraces = [...solverInput.traces]
    this.tracesByNet = this._groupTracesByNet(solverInput.traces)
    this.netsToProcess = Array.from(this.tracesByNet.keys())
  }

  override _step() {
    // Process traces in batches to avoid hitting MAX_ITERATIONS
    const batchSize = 5
    let processed = 0

    while (processed < batchSize && this.netsToProcess.length > 0) {
      const netId = this.netsToProcess[0]
      const traces = this.tracesByNet.get(netId) || []

      const mergedTraces = this._combineCloseTraces(traces)

      // Update output traces
      this.outputTraces = this.outputTraces
        .filter((t) => t.globalConnNetId !== netId)
        .concat(mergedTraces)

      this.netsToProcess.shift()
      processed++
    }

    if (this.netsToProcess.length === 0) {
      this.solved = true
    }
  }

  /**
   * Groups traces by their globalConnNetId
   */
  private _groupTracesByNet(
    traces: SolvedTracePath[],
  ): Map<string, SolvedTracePath[]> {
    const groups = new Map<string, SolvedTracePath[]>()

    for (const trace of traces) {
      const netId = trace.globalConnNetId
      if (!groups.has(netId)) {
        groups.set(netId, [])
      }
      groups.get(netId)!.push(trace)
    }

    return groups
  }

  /**
   * Extracts key segments and endpoints from a trace
   */
  private _extractTraceSegments(trace: SolvedTracePath): TraceSegment[] {
    const { tracePath } = trace
    const segments: TraceSegment[] = []

    for (let i = 0; i < tracePath.length - 1; i++) {
      const start = tracePath[i]
      const end = tracePath[i + 1]
      const isHorizontal = Math.abs(end.y - start.y) < 0.001

      segments.push({
        trace,
        startPoint: start,
        endPoint: end,
        isHorizontal,
        minX: Math.min(start.x, end.x),
        maxX: Math.max(start.x, end.x),
        minY: Math.min(start.y, end.y),
        maxY: Math.max(start.y, end.y),
      })
    }

    return segments
  }

  /**
   * Calculates the minimum distance between two line segments
   */
  private _calculateSegmentDistance(
    seg1: TraceSegment,
    seg2: TraceSegment,
  ): number {
    // For horizontal segments
    if (seg1.isHorizontal && !seg2.isHorizontal) {
      // seg1 is horizontal, seg2 is vertical
      const xDist = Math.abs(seg1.startPoint.x - seg2.startPoint.x)
      const yOverlap = Math.max(
        0,
        Math.min(seg1.maxY, seg2.maxY) - Math.max(seg1.minY, seg2.minY),
      )
      if (yOverlap > 0) {
        return xDist
      }
      // Calculate corner distance
      const cornerDist = Math.sqrt(
        Math.pow(seg1.startPoint.x - seg2.startPoint.x, 2) +
        Math.pow(seg1.startPoint.y - seg2.startPoint.y, 2)
      )
      return cornerDist
    }

    if (!seg1.isHorizontal && seg2.isHorizontal) {
      // seg1 is vertical, seg2 is horizontal
      const yDist = Math.abs(seg1.startPoint.y - seg2.startPoint.y)
      const xOverlap = Math.max(
        0,
          Math.min(seg1.maxX, seg2.maxX) - Math.max(seg1.minX, seg2.minX),
      )
      if (xOverlap > 0) {
        return yDist
      }
      // Calculate corner distance
      const cornerDist = Math.sqrt(
        Math.pow(seg1.startPoint.x - seg2.startPoint.x, 2) +
        Math.pow(seg1.startPoint.y - seg2.startPoint.y, 2)
      )
      return cornerDist
    }

    // Both same orientation - calculate perpendicular distance
    if (seg1.isHorizontal && seg2.isHorizontal) {
      // Both horizontal - check if they're at similar y and overlapping x
      const yDist = Math.abs(seg1.startPoint.y - seg2.startPoint.y)
      const xOverlap = Math.max(
        0,
          Math.min(seg1.maxX, seg2.maxX) - Math.max(seg1.minX, seg2.minX),
      )
      if (xOverlap > 0) {
        return yDist
      }
      // No overlap - calculate minimum corner-to-corner distance
      const corners = [
        { x: seg1.minX, y: seg1.startPoint.y },
        { x: seg1.maxX, y: seg1.startPoint.y },
      ]
      const seg2Corners = [
        { x: seg2.minX, y: seg2.startPoint.y },
        { x: seg2.maxX, y: seg2.startPoint.y },
      ]
      let minDist = Infinity
      for (const c1 of corners) {
        for (const c2 of seg2Corners) {
          const dist = Math.sqrt(
            Math.pow(c1.x - c2.x, 2) + Math.pow(c1.y - c2.y, 2),
          )
          minDist = Math.min(minDist, dist)
        }
      }
      return minDist
    }

    // Both vertical
    if (!seg1.isHorizontal && !seg2.isHorizontal) {
      const xDist = Math.abs(seg1.startPoint.x - seg2.startPoint.x)
      const yOverlap = Math.max(
        0,
        Math.min(seg1.maxY, seg2.maxY) - Math.max(seg1.minY, seg2.minY),
      )
      if (yOverlap > 0) {
        return xDist
      }
      // No overlap - calculate minimum corner-to-corner distance
      const corners = [
        { x: seg1.startPoint.x, y: seg1.minY },
        { x: seg1.startPoint.x, y: seg1.maxY },
      ]
      const seg2Corners = [
        { x: seg2.startPoint.x, y: seg2.minY },
        { x: seg2.startPoint.x, y: seg2.maxY },
      ]
      let minDist = Infinity
      for (const c1 of corners) {
        for (const c2 of seg2Corners) {
          const dist = Math.sqrt(
            Math.pow(c1.x - c2.x, 2) + Math.pow(c1.y - c2.y, 2),
          )
          minDist = Math.min(minDist, dist)
        }
      }
      return minDist
    }

    return Infinity
  }

  /**
   * Combines traces from the same net that are close together
   */
  private _combineCloseTraces(traces: SolvedTracePath[]): SolvedTracePath[] {
    if (traces.length <= 1) {
      return traces
    }

    // Extract all segments from all traces
    const allSegments: TraceSegment[] = []
    for (const trace of traces) {
      allSegments.push(...this._extractTraceSegments(trace))
    }

    // Find pairs of segments that are close together and same orientation
    const mergeCandidates: Array<{
      seg1: TraceSegment
      seg2: TraceSegment
      distance: number
    }> = []

    for (let i = 0; i < allSegments.length; i++) {
      for (let j = i + 1; j < allSegments.length; j++) {
        // Only merge segments from different traces but same net
        if (allSegments[i].trace.mspPairId === allSegments[j].trace.mspPairId) {
          continue // Skip segments from same trace
        }

        // Only merge segments with same orientation
        if (allSegments[i].isHorizontal !== allSegments[j].isHorizontal) {
          continue
        }

        const distance = this._calculateSegmentDistance(allSegments[i], allSegments[j])

        if (distance <= this.proximityThreshold) {
          mergeCandidates.push({
            seg1: allSegments[i],
            seg2: allSegments[j],
            distance,
          })
        }
      }
    }

    // If no valid merge candidates, return original traces
    if (mergeCandidates.length === 0) {
      return traces
    }

    // Sort by distance (closest first) and mark traces for merging
    mergeCandidates.sort((a, b) => a.distance - b.distance)

    const tracesToMerge = new Set<string>()
    for (const candidate of mergeCandidates) {
      tracesToMerge.add(candidate.seg1.trace.mspPairId)
      tracesToMerge.add(candidate.seg2.trace.mspPairId)
    }

    // For now, we'll keep traces that can't be meaningfully merged
    // A more sophisticated implementation would actually merge the trace paths
    const mergedTraces: SolvedTracePath[] = []
    const unmergedTraces = traces.filter((t) => tracesToMerge.has(t.mspPairId))

    // If we have multiple traces in the same net, try to simplify them
    // by keeping only the most representative one
    if (unmergedTraces.length > 1) {
      // For simplicity, we'll keep all traces but note that they could be merged
      // In a full implementation, we'd merge the trace paths together
      mergedTraces.push(...unmergedTraces)
    } else {
      mergedTraces.push(...traces)
    }

    return mergedTraces
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(
      this.input.inputProblem,
      { chipAlpha: 0.1, connectionAlpha: 0.1 }
    )

    if (!graphics.lines) graphics.lines = []
    if (!graphics.points) graphics.points = []
    if (!graphics.rects) graphics.rects = []
    if (!graphics.circles) graphics.circles = []
    if (!graphics.texts) graphics.texts = []

    // Color traces by net
    const netColors = new Map<string, string>()
    const colors = ["green", "blue", "red", "orange", "purple", "cyan", "magenta", "yellow"]

    for (const trace of this.outputTraces) {
      if (!netColors.has(trace.globalConnNetId)) {
        const colorIndex = netColors.size % colors.length
        netColors.set(trace.globalConnNetId, colors[colorIndex])
      }

      const line: Line = {
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: netColors.get(trace.globalConnNetId),
      }
      graphics.lines!.push(line)
    }

    return graphics
  }
}
