import type { Point } from "@tscircuit/math-utils"
import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"

interface SameNetTraceMergeSolverInput {
  inputProblem: InputProblem
  allTraces: SolvedTracePath[]
}

/**
 * SameNetTraceMergeSolver finds traces belonging to the same electrical net
 * whose paths run close together and merges them into a single shared
 * segment, reducing visual clutter in the schematic.
 *
 * Algorithm:
 * 1. Group traces by net ID (dcConnNetId / globalConnNetId / userNetId)
 * 2. For each net group with >=2 traces, find pairs with nearby parallel segments
 * 3. Merge those traces by rerouting to share a common path
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  private input: SameNetTraceMergeSolverInput
  private outputTraces: SolvedTracePath[]
  private netGroups: Map<string, SolvedTracePath[]>
  private netGroupQueue: string[]
  private readonly MERGE_DISTANCE_THRESHOLD = 0.5
  private readonly PARALLEL_ALIGNMENT_THRESHOLD = 0.3

  constructor(solverInput: SameNetTraceMergeSolverInput) {
    super()
    this.input = solverInput
    this.outputTraces = [...solverInput.allTraces]

    // Group traces by net ID
    this.netGroups = new Map()
    for (const trace of solverInput.allTraces) {
      const netId = trace.userNetId ?? trace.dcConnNetId ?? trace.globalConnNetId
      const group = this.netGroups.get(netId) ?? []
      group.push(trace)
      this.netGroups.set(netId, group)
    }

    // Only process groups with 2+ traces
    this.netGroupQueue = Array.from(this.netGroups.entries())
      .filter(([_, traces]) => traces.length >= 2)
      .map(([netId]) => netId)

    this.MAX_ITERATIONS = this.netGroupQueue.length * 2 + 1
  }

  override _step() {
    if (this.netGroupQueue.length === 0) {
      this.solved = true
      return
    }

    const netId = this.netGroupQueue.shift()!
    const traces = this.netGroups.get(netId)!

    this.mergeTracesInGroup(netId, traces)
  }

  /**
   * Find parallel segments between traces of the same net and merge them.
   * A "segment" is a pair of consecutive points in a trace path.
   */
  private mergeTracesInGroup(netId: string, traces: SolvedTracePath[]) {
    let madeChanges = true
    let iterations = 0
    const maxIterations = traces.length * 3

    while (madeChanges && iterations < maxIterations) {
      madeChanges = false
      iterations++

      for (let i = 0; i < traces.length; i++) {
        if (madeChanges) break
        for (let j = i + 1; j < traces.length; j++) {
          if (madeChanges) break
          const traceA = traces[i]
          const traceB = traces[j]

          const merged = this.tryMergePair(traceA, traceB)
          if (merged) {
            // Replace traceA with merged version
            traces[i] = merged
            // Remove traceB (merged into traceA)
            traces.splice(j, 1)
            // Update output traces
            this.outputTraces = this.outputTraces.filter(
              (t) => t.mspPairId !== traceB.mspPairId,
            )
            const idx = this.outputTraces.findIndex(
              (t) => t.mspPairId === traceA.mspPairId,
            )
            if (idx >= 0) {
              this.outputTraces[idx] = merged
            }
            madeChanges = true
          }
        }
      }
    }
  }

  /**
   * Attempt to merge two same-net traces.
   * Returns the merged trace or null if no suitable merge found.
   */
  private tryMergePair(
    traceA: SolvedTracePath,
    traceB: SolvedTracePath,
  ): SolvedTracePath | null {
    const mergeInfo = this.findParallelOverlap(traceA.tracePath, traceB.tracePath)
    if (!mergeInfo) return null

    const mergedPath = this.combinePaths(
      traceA.tracePath,
      traceB.tracePath,
      mergeInfo,
    )

    return {
      ...traceA,
      tracePath: simplifyPath(mergedPath),
      mspConnectionPairIds: [
        ...traceA.mspConnectionPairIds,
        ...traceB.mspConnectionPairIds,
      ],
      pinIds: [...traceA.pinIds, ...traceB.pinIds],
    }
  }

  /**
   * Find a pair of segments (one from each path) that are:
   * - Parallel (both horizontal or both vertical)
   * - Within MERGE_DISTANCE_THRESHOLD of each other
   * - Overlapping in the perpendicular axis
   */
  private findParallelOverlap(
    pathA: Point[],
    pathB: Point[],
  ): { joinPoint: Point; fromA: number; fromB: number } | null {
    for (let i = 0; i < pathA.length - 1; i++) {
      const ax1 = pathA[i].x
      const ay1 = pathA[i].y
      const ax2 = pathA[i + 1].x
      const ay2 = pathA[i + 1].y

      const isHorizA = ay1 === ay2
      const isVertA = ax1 === ax2

      for (let j = 0; j < pathB.length - 1; j++) {
        const bx1 = pathB[j].x
        const by1 = pathB[j].y
        const bx2 = pathB[j + 1].x
        const by2 = pathB[j + 1].y

        const isHorizB = by1 === by2
        const isVertB = bx1 === bx2

        if (isHorizA && isHorizB) {
          const yDist = Math.abs(ay1 - by1)
          if (yDist <= this.MERGE_DISTANCE_THRESHOLD) {
            const aMin = Math.min(ax1, ax2)
            const aMax = Math.max(ax1, ax2)
            const bMin = Math.min(bx1, bx2)
            const bMax = Math.max(bx1, bx2)
            if (Math.max(aMin, bMin) < Math.min(aMax, bMax)) {
              return {
                joinPoint: {
                  x: (Math.max(aMin, bMin) + Math.min(aMax, bMax)) / 2,
                  y: (ay1 + by1) / 2,
                },
                fromA: i,
                fromB: j,
              }
            }
          }
        }

        if (isVertA && isVertB) {
          const xDist = Math.abs(ax1 - bx1)
          if (xDist <= this.MERGE_DISTANCE_THRESHOLD) {
            const aMin = Math.min(ay1, ay2)
            const aMax = Math.max(ay1, ay2)
            const bMin = Math.min(by1, by2)
            const bMax = Math.max(by1, by2)
            if (Math.max(aMin, bMin) < Math.min(aMax, bMax)) {
              return {
                joinPoint: {
                  x: (ax1 + bx1) / 2,
                  y: (Math.max(aMin, bMin) + Math.min(aMax, bMax)) / 2,
                },
                fromA: i,
                fromB: j,
              }
            }
          }
        }
      }
    }

    return null
  }

  /**
   * Combine two paths by routing both through the merge point.
   * Keeps traceA's full path and appends traceB's path after the merge point.
   */
  private combinePaths(
    pathA: Point[],
    pathB: Point[],
    mergeInfo: { joinPoint: Point; fromA: number; fromB: number },
  ): Point[] {
    // Splice traceB's post-merge segment into traceA at the merge point
    const result = [...pathA.slice(0, mergeInfo.fromA + 1)]
    result.push(mergeInfo.joinPoint)
    result.push(...pathB.slice(mergeInfo.fromB + 1))
    return result
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

    for (const trace of this.outputTraces) {
      graphics.lines.push({
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "blue",
      })
    }

    return graphics
  }
}
