import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem, NetId } from "lib/types/InputProblem"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { GraphicsObject } from "graphics-debug"

interface SameNetCollinearTraceMergerInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
}

interface SameNetGroup {
  netId: string
  traces: SolvedTracePath[]
}

/**
 * SameNetCollinearTraceMerger merges trace segments that:
 * 1. Belong to the same net (same globalConnNetId)
 * 2. Are collinear (on same X or same Y axis)
 * 3. Are close enough to be merged
 */
export class SameNetCollinearTraceMerger extends BaseSolver {
  private input: SameNetCollinearTraceMergerInput
  private outputTraces: SolvedTracePath[]
  private currentGroupIndex = 0
  private currentTraceIndex = 0
  private phase: "grouping" | "merging" | "done" = "grouping"
  private netGroups: SameNetGroup[] = []
  private mergedTraces: SolvedTracePath[] = []

  constructor(solverInput: SameNetCollinearTraceMergerInput) {
    super()
    this.input = solverInput
    this.outputTraces = [...solverInput.traces]
  }

  override _step() {
    switch (this.phase) {
      case "grouping":
        this._groupByNet()
        break
      case "merging":
        this._mergeCollinearTraces()
        break
      case "done":
        this.solved = true
        break
    }
  }

  private _groupByNet() {
    // Group traces by their netId
    const netMap = new Map<NetId, SolvedTracePath[]>()

    for (const trace of this.outputTraces) {
      const netId = trace.globalConnNetId
      if (!netMap.has(netId)) {
        netMap.set(netId, [])
      }
      netMap.get(netId)!.push(trace)
    }

    this.netGroups = Array.from(netMap.entries()).map(([netId, traces]) => ({
      netId,
      traces,
    }))

    this.phase = "merging"
    this.currentGroupIndex = 0
    this.currentTraceIndex = 0
    this.mergedTraces = []
  }

  private _mergeCollinearTraces() {
    if (this.currentGroupIndex >= this.netGroups.length) {
      this.phase = "done"
      return
    }

    const group = this.netGroups[this.currentGroupIndex]
    const traces = group.traces

    // Find collinear traces in same group
    let merged = false
    for (let i = 0; i < traces.length; i++) {
      for (let j = i + 1; j < traces.length; j++) {
        const traceA = traces[i]
        const traceB = traces[j]

        if (!traceA || !traceB) continue

        const mergedTrace = this._tryMergeTraces(traceA, traceB)
        if (mergedTrace) {
          // Replace traces with merged trace
          const newTraces = traces.filter((_, idx) => idx !== i && idx !== j)
          newTraces.push(mergedTrace)
          group.traces = newTraces
          merged = true
          break
        }
      }
      if (merged) break
    }

    if (!merged) {
      // No more merges possible for this group, move to next
      this.mergedTraces.push(...group.traces)
      this.currentGroupIndex++
      this.currentTraceIndex = 0
    }

    this.outputTraces = this.mergedTraces.concat(
      this.netGroups.slice(this.currentGroupIndex).flatMap((g) => g.traces),
    )
  }

  private _tryMergeTraces(
    traceA: SolvedTracePath,
    traceB: SolvedTracePath,
  ): SolvedTracePath | null {
    // Check if traces are collinear (same X or same Y for all points)
    const pathA = traceA.tracePath
    const pathB = traceB.tracePath

    if (pathA.length < 2 || pathB.length < 2) return null

    // Get bounding boxes
    const bboxA = this._getBoundingBox(pathA)
    const bboxB = this._getBoundingBox(pathB)

    // Check if on same axis and overlapping
    const sameX = bboxA.minX === bboxB.minX && bboxA.maxX === bboxB.maxX
    const sameY = bboxA.minY === bboxB.minY && bboxB.maxY === bboxB.maxY

    if (!sameX && !sameY) return null

    // Check for overlap on the axis
    const aOverlapsB = this._rangesOverlap(
      bboxA.minX,
      bboxA.maxX,
      bboxB.minX,
      bboxB.maxX,
    )
    const bOverlapsA = this._rangesOverlap(
      bboxB.minX,
      bboxB.maxX,
      bboxA.minX,
      bboxA.maxX,
    )

    if (!aOverlapsB && !bOverlapsA) return null

    // Merge the traces
    const mergedPath = this._mergePaths(pathA, pathB, sameX ? "x" : "y")

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

  private _getBoundingBox(path: Point[]): {
    minX: number
    maxX: number
    minY: number
    maxY: number
  } {
    let minX = Infinity,
      maxX = -Infinity
    let minY = Infinity,
      maxY = -Infinity

    for (const p of path) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }

    return { minX, maxX, minY, maxY }
  }

  private _rangesOverlap(
    aMin: number,
    aMax: number,
    bMin: number,
    bMax: number,
  ): boolean {
    return aMin <= bMax && aMax >= bMin
  }

  private _mergePaths(
    pathA: Point[],
    pathB: Point[],
    axis: "x" | "y",
  ): Point[] {
    // Merge two paths on same axis into one continuous path
    const allPoints = [...pathA, ...pathB]

    // Sort by the axis
    allPoints.sort((a, b) => (axis === "x" ? a.x - b.x : a.y - b.y))

    // Remove duplicates (points that are very close)
    const merged: Point[] = [allPoints[0]!]
    for (let i = 1; i < allPoints.length; i++) {
      const last = merged[merged.length - 1]!
      const curr = allPoints[i]
      const dist =
        axis === "x" ? Math.abs(curr.x - last.x) : Math.abs(curr.y - last.y)
      if (dist > 0.001) {
        merged.push(curr)
      }
    }

    return merged
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

    // Color traces by net
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
