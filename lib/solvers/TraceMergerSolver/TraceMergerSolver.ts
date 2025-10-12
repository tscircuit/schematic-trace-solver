import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import type { InputPin } from "lib/types/InputProblem"

/**
 * This solver merges trace segments that belong to the same net and are close together
 * along the same axis (either same X for vertical segments or same Y for horizontal segments).
 * This helps clean up the schematic by reducing visual clutter from parallel traces.
 */
export class TraceMergerSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  mergedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}

  constructor(params: {
    inputProblem: InputProblem
    inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraceMap = params.inputTraceMap
    this.mergedTraceMap = structuredClone(params.inputTraceMap)
  }

  override getConstructorParams(): ConstructorParameters<
    typeof TraceMergerSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
    }
  }

  override _step() {
    // Group traces by net
    const tracesByNet: Record<string, SolvedTracePath[]> = {}
    for (const trace of Object.values(this.mergedTraceMap)) {
      const netId = trace.globalConnNetId
      if (!tracesByNet[netId]) tracesByNet[netId] = []
      tracesByNet[netId].push(trace)
    }

    // For each net, find and merge close parallel segments
    let mergePerformed = false
    for (const [netId, traces] of Object.entries(tracesByNet)) {
      if (traces.length < 2) continue

      // Find segments that can be merged
      for (let i = 0; i < traces.length && !mergePerformed; i++) {
        for (let j = i + 1; j < traces.length && !mergePerformed; j++) {
          const trace1 = traces[i]!
          const trace2 = traces[j]!

          // Try to merge these two traces
          const merged = this.mergeTraces(trace1, trace2)
          if (merged) {
            // Update the trace map with the merged trace
            this.mergedTraceMap[trace1.mspPairId] = merged
            // Remove the second trace
            delete this.mergedTraceMap[trace2.mspPairId]
            mergePerformed = true
          }
        }
      }
    }

    if (!mergePerformed) {
      this.solved = true
    }
  }

  private mergeTraces(
    trace1: SolvedTracePath,
    trace2: SolvedTracePath,
  ): SolvedTracePath | null {
    const MERGE_THRESHOLD = 0.1 // Distance threshold for merging

    // Check if traces have segments that are close and parallel
    const path1 = trace1.tracePath
    const path2 = trace2.tracePath

    // Check if endpoints are close enough to merge
    const start1 = path1[0]!
    const end1 = path1[path1.length - 1]!
    const start2 = path2[0]!
    const end2 = path2[path2.length - 1]!

    // Try to connect end1 to start2
    if (this.canConnect(end1, start2, MERGE_THRESHOLD)) {
      // Keep the original 2-pin structure by using the start and end pins
      const pin1 = trace1.pins[0]
      const pin2 = trace2.pins[1]
      return {
        ...trace1,
        tracePath: [...path1.slice(0, -1), ...path2],
        mspPairId: trace1.mspPairId, // Keep first trace's ID
        mspConnectionPairIds: [
          ...trace1.mspConnectionPairIds,
          ...trace2.mspConnectionPairIds,
        ],
        pinIds: [pin1.pinId, pin2.pinId],
        pins: [pin1, pin2] as [
          InputPin & { chipId: string },
          InputPin & { chipId: string },
        ],
      }
    }

    // Try to connect end2 to start1
    if (this.canConnect(end2, start1, MERGE_THRESHOLD)) {
      const pin1 = trace2.pins[0]
      const pin2 = trace1.pins[1]
      return {
        ...trace1,
        tracePath: [...path2.slice(0, -1), ...path1],
        mspPairId: trace1.mspPairId,
        mspConnectionPairIds: [
          ...trace2.mspConnectionPairIds,
          ...trace1.mspConnectionPairIds,
        ],
        pinIds: [pin1.pinId, pin2.pinId],
        pins: [pin1, pin2] as [
          InputPin & { chipId: string },
          InputPin & { chipId: string },
        ],
      }
    }

    // Try to connect start1 to start2 (reverse one path)
    if (this.canConnect(start1, start2, MERGE_THRESHOLD)) {
      const pin1 = trace2.pins[1]
      const pin2 = trace1.pins[1]
      return {
        ...trace1,
        tracePath: [...path2.slice().reverse().slice(0, -1), ...path1],
        mspPairId: trace1.mspPairId,
        mspConnectionPairIds: [
          ...trace2.mspConnectionPairIds,
          ...trace1.mspConnectionPairIds,
        ],
        pinIds: [pin1.pinId, pin2.pinId],
        pins: [pin1, pin2] as [
          InputPin & { chipId: string },
          InputPin & { chipId: string },
        ],
      }
    }

    // Try to connect end1 to end2 (reverse one path)
    if (this.canConnect(end1, end2, MERGE_THRESHOLD)) {
      const pin1 = trace1.pins[0]
      const pin2 = trace2.pins[0]
      return {
        ...trace1,
        tracePath: [...path1.slice(0, -1), ...path2.slice().reverse()],
        mspPairId: trace1.mspPairId,
        mspConnectionPairIds: [
          ...trace1.mspConnectionPairIds,
          ...trace2.mspConnectionPairIds,
        ],
        pinIds: [pin1.pinId, pin2.pinId],
        pins: [pin1, pin2] as [
          InputPin & { chipId: string },
          InputPin & { chipId: string },
        ],
      }
    }

    return null
  }

  private canConnect(p1: Point, p2: Point, threshold: number): boolean {
    // Check if points are aligned on same X or Y axis and close enough
    const sameX = Math.abs(p1.x - p2.x) < threshold
    const sameY = Math.abs(p1.y - p2.y) < threshold
    const distance = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)

    // Points should be aligned on one axis and close together
    return (sameX || sameY) && distance < threshold * 2
  }

  override visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      circles: [],
      rects: [],
      texts: [],
    }

    // Draw merged traces
    for (const trace of Object.values(this.mergedTraceMap)) {
      graphics.lines?.push({
        points: trace.tracePath,
        strokeColor: "green",
        strokeWidth: 2,
      })
    }

    return graphics
  }
}
