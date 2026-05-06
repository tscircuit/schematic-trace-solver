import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { GraphicsObject } from "graphics-debug"

interface TraceCombineSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  proximityThreshold?: number
}

interface TraceGroup {
  netId: string
  traces: SolvedTracePath[]
  mergedTraces: SolvedTracePath[]
}

/**
 * TraceCombineSolver merges trace segments belonging to the same net
 * that are collinear (same X or same Y) and close together.
 *
 * This addresses issue #29 where 3 collinear pins resulted in 2 separate
 * segments instead of 1 continuous trace.
 */
export class TraceCombineSolver extends BaseSolver {
  private input: TraceCombineSolverInput
  private tracesByNet: Map<string, SolvedTracePath[]>
  private outputTraces: SolvedTracePath[]
  private threshold: number

  constructor(solverInput: TraceCombineSolverInput) {
    super()
    this.input = solverInput
    this.threshold = solverInput.proximityThreshold ?? 0.1
    this.tracesByNet = new Map()
    this.outputTraces = []
    this._groupTracesByNet()
  }

  private _groupTracesByNet() {
    for (const trace of this.input.traces) {
      const netId = trace.globalConnNetId
      if (!this.tracesByNet.has(netId)) {
        this.tracesByNet.set(netId, [])
      }
      this.tracesByNet.get(netId)!.push(trace)
    }
  }

  override _step() {
    const nets = Array.from(this.tracesByNet.keys())

    for (const netId of nets) {
      const netTraces = this.tracesByNet.get(netId)!
      if (netTraces.length < 2) {
        this.outputTraces.push(...netTraces)
        continue
      }

      const merged = this._mergeCollinearTraces(netTraces)
      this.outputTraces.push(...merged)
    }

    this.solved = true
  }

  private _mergeCollinearTraces(traces: SolvedTracePath[]): SolvedTracePath[] {
    if (traces.length < 2) return traces

    // Group traces by their primary axis (horizontal or vertical)
    const horizontalTraces: SolvedTracePath[] = []
    const verticalTraces: SolvedTracePath[] = []

    for (const trace of traces) {
      const axis = this._getTraceAxis(trace.tracePath)
      if (axis === "horizontal") {
        horizontalTraces.push(trace)
      } else if (axis === "vertical") {
        verticalTraces.push(trace)
      } else {
        // Non-axis-aligned traces pass through unchanged
        this.outputTraces.push(trace)
      }
    }

    // Merge horizontal traces on same Y
    const mergedHorizontal = this._mergeTracesOnSameAxis(
      horizontalTraces,
      "horizontal",
    )
    // Merge vertical traces on same X
    const mergedVertical = this._mergeTracesOnSameAxis(
      verticalTraces,
      "vertical",
    )

    return [...mergedHorizontal, ...mergedVertical]
  }

  private _getTraceAxis(path: Point[]): "horizontal" | "vertical" | "other" {
    if (path.length < 2) return "other"

    // Check if all points are on same Y (horizontal) or same X (vertical)
    const firstY = path[0]!.y
    const firstX = path[0]!.x

    let allSameY = true
    let allSameX = true

    for (let i = 1; i < path.length; i++) {
      if (Math.abs(path[i]!.y - firstY) > 0.001) allSameY = false
      if (Math.abs(path[i]!.x - firstX) > 0.001) allSameX = false
    }

    if (allSameY) return "horizontal"
    if (allSameX) return "vertical"
    return "other"
  }

  private _mergeTracesOnSameAxis(
    traces: SolvedTracePath[],
    axis: "horizontal" | "vertical",
  ): SolvedTracePath[] {
    if (traces.length < 2) return traces

    // Group by coordinate (Y for horizontal, X for vertical)
    const groups = new Map<number, SolvedTracePath[]>()

    for (const trace of traces) {
      const coord =
        axis === "horizontal" ? trace.tracePath[0]!.y : trace.tracePath[0]!.x
      // Round to avoid floating point issues
      const roundedCoord = Math.round(coord * 100) / 100
      if (!groups.has(roundedCoord)) {
        groups.set(roundedCoord, [])
      }
      groups.get(roundedCoord)!.push(trace)
    }

    const result: SolvedTracePath[] = []

    for (const [coord, groupTraces] of groups) {
      if (groupTraces.length < 2) {
        result.push(...groupTraces)
        continue
      }

      // Sort by start coordinate
      groupTraces.sort((a, b) => {
        const aStart =
          axis === "horizontal" ? a.tracePath[0]!.x : a.tracePath[0]!.y
        const bStart =
          axis === "horizontal" ? b.tracePath[0]!.x : b.tracePath[0]!.y
        return aStart - bStart
      })

      // Try to merge consecutive traces
      let currentTrace = groupTraces[0]!

      for (let i = 1; i < groupTraces.length; i++) {
        const nextTrace = groupTraces[i]!
        const merged = this._tryMergeTraces(currentTrace, nextTrace, axis)

        if (merged) {
          currentTrace = merged
        } else {
          result.push(currentTrace)
          currentTrace = nextTrace
        }
      }

      result.push(currentTrace)
    }

    return result
  }

  private _tryMergeTraces(
    traceA: SolvedTracePath,
    traceB: SolvedTracePath,
    axis: "horizontal" | "vertical",
  ): SolvedTracePath | null {
    // Get end of traceA and start of traceB
    const aEnd = traceA.tracePath[traceA.tracePath.length - 1]!
    const bStart = traceB.tracePath[0]!

    // Check if they're close enough to merge
    const distance =
      axis === "horizontal"
        ? Math.abs(aEnd.x - bStart.x)
        : Math.abs(aEnd.y - bStart.y)

    if (distance > this.threshold) {
      return null
    }

    // Check if they're collinear (same Y for horizontal, same X for vertical)
    const aY = traceA.tracePath[0]!.y
    const bY = traceB.tracePath[0]!.y
    const aX = traceA.tracePath[0]!.x
    const bX = traceB.tracePath[0]!.x

    if (axis === "horizontal" && Math.abs(aY - bY) > 0.001) return null
    if (axis === "vertical" && Math.abs(aX - bX) > 0.001) return null

    // Merge: combine paths
    const mergedPath = [
      ...traceA.tracePath,
      ...traceB.tracePath.slice(1), // Skip duplicate point at junction
    ]

    return {
      ...traceA,
      tracePath: mergedPath,
      mspConnectionPairIds: [
        ...traceA.mspConnectionPairIds,
        ...traceB.mspConnectionPairIds,
      ],
      pinIds: [...traceA.pinIds, ...traceB.pinIds],
    }
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.input.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    if (!graphics.lines) graphics.lines = []
    if (!graphics.points) graphics.points = []
    if (!graphics.rects) graphics.rects = []
    if (!graphics.circles) graphics.circles = []
    if (!graphics.texts) graphics.texts = []

    const colors = [
      "red",
      "blue",
      "green",
      "orange",
      "purple",
      "cyan",
      "magenta",
      "yellow",
    ]
    for (let i = 0; i < this.outputTraces.length; i++) {
      const trace = this.outputTraces[i]
      graphics.lines!.push({
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: colors[i % colors.length],
      })
    }

    return graphics
  }
}
