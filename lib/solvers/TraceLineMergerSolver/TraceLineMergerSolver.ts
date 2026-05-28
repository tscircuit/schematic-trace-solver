
import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Point } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"

/**
 * Input for the TraceLineMergerSolver
 */
interface TraceLineMergerSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
}

/**
 * The TraceLineMergerSolver is responsible for merging same-net trace lines that are
 * close together and nearly collinear or stair-stepping. It identifies trace segments
 * that can be merged into a single line at the same Y or same X coordinate without
 * creating new intersections or shorts with different nets.
 */
export class TraceLineMergerSolver extends BaseSolver {
  private input: TraceLineMergerSolverInput
  private outputTraces: SolvedTracePath[]
  private traceMap: Map<string, SolvedTracePath>
  private netToTracesMap: Map<string, SolvedTracePath[]>

  constructor(solverInput: TraceLineMergerSolverInput) {
    super()
    this.input = solverInput
    this.outputTraces = [...solverInput.traces]
    this.traceMap = new Map(this.outputTraces.map(t => [t.mspPairId, t]))

    // Create a map from netId to traces
    this.netToTracesMap = new Map()
    for (const trace of this.outputTraces) {
      if (!this.netToTracesMap.has(trace.netId)) {
        this.netToTracesMap.set(trace.netId, [])
      }
      this.netToTracesMap.get(trace.netId)!.push(trace)
    }
  }

  /**
   * Check if two points are close enough to be considered for merging
   */
  private arePointsClose(p1: Point, p2: Point, threshold = 5): boolean {
    return Math.abs(p1.x - p2.x) <= threshold && Math.abs(p1.y - p2.y) <= threshold
  }

  /**
   * Check if two segments are collinear and can be merged
   */
  private areSegmentsCollinear(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
    // Check if segments are horizontal and at the same Y level
    if (p1.y === p2.y && p3.y === p4.y && p1.y === p3.y) {
      return true
    }
    // Check if segments are vertical and at the same X level
    if (p1.x === p2.x && p3.x === p4.x && p1.x === p3.x) {
      return true
    }
    return false
  }

  /**
   * Check if merging two segments would create a collision with other traces
   */
  private wouldCreateCollision(
    trace1: SolvedTracePath,
    trace2: SolvedTracePath,
    mergedPath: Point[]
  ): boolean {
    // For now, we'll implement a simple check that looks for intersections
    // with other traces. A more complete implementation would need to check
    // against all other traces in the design.

    // Get all traces except the two we're merging
    const otherTraces = this.outputTraces.filter(
      t => t.mspPairId !== trace1.mspPairId && t.mspPairId !== trace2.mspPairId
    )

    // Check if the merged path intersects with any other trace
    for (const otherTrace of otherTraces) {
      for (let i = 0; i < otherTrace.tracePath.length - 1; i++) {
        const seg1Start = otherTrace.tracePath[i]
        const seg1End = otherTrace.tracePath[i + 1]

        for (let j = 0; j < mergedPath.length - 1; j++) {
          const seg2Start = mergedPath[j]
          const seg2End = mergedPath[j + 1]

          if (this.doSegmentsIntersect(seg1Start, seg1End, seg2Start, seg2End)) {
            return true
          }
        }
      }
    }

    return false
  }

  /**
   * Check if two line segments intersect
   */
  private doSegmentsIntersect(
    p1: Point, p2: Point,
    p3: Point, p4: Point
  ): boolean {
    // Implementation of line segment intersection check
    const ccw = (A: Point, B: Point, C: Point) => {
      return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x)
    }

    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  }

  /**
   * Try to merge two traces that are on the same net
   */
  private tryMergeTraces(trace1: SolvedTracePath, trace2: SolvedTracePath): SolvedTracePath | null {
    // Check if traces are on the same net
    if (trace1.netId !== trace2.netId) {
      return null
    }

    // Check if traces are close to each other
    const path1 = trace1.tracePath
    const path2 = trace2.tracePath

    // Check if any points from trace1 are close to any points from trace2
    let closePointsFound = false
    for (const p1 of path1) {
      for (const p2 of path2) {
        if (this.arePointsClose(p1, p2)) {
          closePointsFound = true
          break
        }
      }
      if (closePointsFound) break
    }

    if (!closePointsFound) {
      return null
    }

    // Try to find segments that can be merged
    for (let i = 0; i < path1.length - 1; i++) {
      for (let j = 0; j < path2.length - 1; j++) {
        const seg1Start = path1[i]
        const seg1End = path1[i + 1]
        const seg2Start = path2[j]
        const seg2End = path2[j + 1]

        if (this.areSegmentsCollinear(seg1Start, seg1End, seg2Start, seg2End)) {
          // Try to merge the segments
          const mergedPath = this.mergeCollinearSegments(trace1, trace2, i, j)

          if (mergedPath && !this.wouldCreateCollision(trace1, trace2, mergedPath)) {
            // Create a new trace that combines both paths
            return {
              ...trace1,
              tracePath: mergedPath,
              mspConnectionPairIds: [...trace1.mspConnectionPairIds, ...trace2.mspConnectionPairIds],
              pinIds: [...trace1.pinIds, ...trace2.pinIds]
            }
          }
        }
      }
    }

    return null
  }

  /**
   * Merge two collinear segments from different traces
   */
  private mergeCollinearSegments(
    trace1: SolvedTracePath,
    trace2: SolvedTracePath,
    seg1Index: number,
    seg2Index: number
  ): Point[] | null {
    const path1 = trace1.tracePath
    const path2 = trace2.tracePath

    const seg1Start = path1[seg1Index]
    const seg1End = path1[seg1Index + 1]
    const seg2Start = path2[seg2Index]
    const seg2End = path2[seg2Index + 1]

    // Check if segments are horizontal
    if (seg1Start.y === seg1End.y && seg2Start.y === seg2End.y) {
      // Find the min and max X coordinates
      const minX = Math.min(seg1Start.x, seg1End.x, seg2Start.x, seg2End.x)
      const maxX = Math.max(seg1Start.x, seg1End.x, seg2Start.x, seg2End.x)

      // Create a new path that combines both traces
      const mergedPath: Point[] = []

      // Add path1 up to seg1Start
      for (let i = 0; i <= seg1Index; i++) {
        mergedPath.push(path1[i])
      }

      // Add the merged horizontal segment
      mergedPath.push({ x: minX, y: seg1Start.y })
      mergedPath.push({ x: maxX, y: seg1Start.y })

      // Add the rest of path1 from seg1End
      for (let i = seg1Index + 2; i < path1.length; i++) {
        mergedPath.push(path1[i])
      }

      // Add path2, but skip the segment we're merging
      for (let i = 0; i < seg2Index; i++) {
        mergedPath.push(path2[i])
      }
      for (let i = seg2Index + 2; i < path2.length; i++) {
        mergedPath.push(path2[i])
      }

      return mergedPath
    }
    // Check if segments are vertical
    else if (seg1Start.x === seg1End.x && seg2Start.x === seg2End.x) {
      // Find the min and max Y coordinates
      const minY = Math.min(seg1Start.y, seg1End.y, seg2Start.y, seg2End.y)
      const maxY = Math.max(seg1Start.y, seg1End.y, seg2Start.y, seg2End.y)

      // Create a new path that combines both traces
      const mergedPath: Point[] = []

      // Add path1 up to seg1Start
      for (let i = 0; i <= seg1Index; i++) {
        mergedPath.push(path1[i])
      }

      // Add the merged vertical segment
      mergedPath.push({ x: seg1Start.x, y: minY })
      mergedPath.push({ x: seg1Start.x, y: maxY })

      // Add the rest of path1 from seg1End
      for (let i = seg1Index + 2; i < path1.length; i++) {
        mergedPath.push(path1[i])
      }

      // Add path2, but skip the segment we're merging
      for (let i = 0; i < seg2Index; i++) {
        mergedPath.push(path2[i])
      }
      for (let i = seg2Index + 2; i < path2.length; i++) {
        mergedPath.push(path2[i])
      }

      return mergedPath
    }

    return null
  }

  /**
   * Try to merge stair-stepping traces
   */
  private tryMergeStairStepTraces(trace1: SolvedTracePath, trace2: SolvedTracePath): SolvedTracePath | null {
    // Check if traces are on the same net
    if (trace1.netId !== trace2.netId) {
      return null
    }

    const path1 = trace1.tracePath
    const path2 = trace2.tracePath

    // Check if any points from trace1 are close to any points from trace2
    let closePointsFound = false
    for (const p1 of path1) {
      for (const p2 of path2) {
        if (this.arePointsClose(p1, p2)) {
          closePointsFound = true
          break
        }
      }
      if (closePointsFound) break
    }

    if (!closePointsFound) {
      return null
    }

    // Try to find stair-step patterns that can be aligned
    for (let i = 0; i < path1.length - 2; i++) {
      for (let j = 0; j < path2.length - 2; j++) {
        // Check if we have a stair-step pattern in both traces
        const p1 = path1[i]
        const p2 = path1[i + 1]
        const p3 = path1[i + 2]

        const q1 = path2[j]
        const q2 = path2[j + 1]
        const q3 = path2[j + 2]

        // Check if both segments form a stair-step (alternating horizontal/vertical)
        const isStair1 = (p1.x === p2.x && p2.y === p3.y) || (p1.y === p2.y && p2.x === p3.x)
        const isStair2 = (q1.x === q2.x && q2.y === q3.y) || (q1.y === q2.y && q2.x === q3.x)

        if (isStair1 && isStair2) {
          // Try to align the stair steps
          const mergedPath = this.alignStairSteps(trace1, trace2, i, j)

          if (mergedPath && !this.wouldCreateCollision(trace1, trace2, mergedPath)) {
            // Create a new trace that combines both paths
            return {
              ...trace1,
              tracePath: mergedPath,
              mspConnectionPairIds: [...trace1.mspConnectionPairIds, ...trace2.mspConnectionPairIds],
              pinIds: [...trace1.pinIds, ...trace2.pinIds]
            }
          }
        }
      }
    }

    return null
  }

  /**
   * Align stair-step patterns in two traces
   */
  private alignStairSteps(
    trace1: SolvedTracePath,
    trace2: SolvedTracePath,
    seg1Index: number,
    seg2Index: number
  ): Point[] | null {
    const path1 = trace1.tracePath
    const path2 = trace2.tracePath

    const p1 = path1[seg1Index]
    const p2 = path1[seg1Index + 1]
    const p3 = path1[seg1Index + 2]

    const q1 = path2[seg2Index]
    const q2 = path2[seg2Index + 1]
    const q3 = path2[seg2Index + 2]

    // Determine if the stair steps are horizontal-vertical or vertical-horizontal
    const isHV1 = p1.x === p2.x && p2.y === p3.y  // Vertical then horizontal
    const isVH1 = p1.y === p2.y && p2.x === p3.x  // Horizontal then vertical

    const isHV2 = q1.x === q2.x && q2.y === q3.y  // Vertical then horizontal
    const isVH2 = q1.y === q2.y && q2.x === q3.x  // Horizontal then vertical

    // We can only align stair steps of the same type
    if ((isHV1 && !isHV2) || (isVH1 && !isVH2)) {
      return null
    }

    // Create a new path that combines both traces with aligned stair steps
    const mergedPath: Point[] = []

    // Add path1 up to the stair step
    for (let i = 0; i <= seg1Index; i++) {
      mergedPath.push(path1[i])
    }

    // Add the aligned stair step
    if (isHV1) {  // Vertical then horizontal
      // Align the vertical segments
      const y1 = Math.min(p1.y, p3.y, q1.y, q3.y)
      const y2 = Math.max(p1.y, p3.y, q1.y, q3.y)

      // Align the horizontal segments
      const x1 = Math.min(p2.x, p3.x, q2.x, q3.x)
      const x2 = Math.max(p2.x, p3.x, q2.x, q3.x)

      // Add the aligned vertical segment
      mergedPath.push({ x: p1.x, y: y1 })
      mergedPath.push({ x: p1.x, y: y2 })

      // Add the aligned horizontal segment
      mergedPath.push({ x: x1, y: y2 })
      mergedPath.push({ x: x2, y: y2 })
    } else {  // Horizontal then vertical
      // Align the horizontal segments
      const x1 = Math.min(p1.x, p2.x, q1.x, q2.x)
      const x2 = Math.max(p1.x, p2.x, q1.x, q2.x)

      // Align the vertical segments
      const y1 = Math.min(p2.y, p3.y, q2.y, q3.y)
      const y2 = Math.max(p2.y, p3.y, q2.y, q3.y)

      // Add the aligned horizontal segment
      mergedPath.push({ x: x1, y: p1.y })
      mergedPath.push({ x: x2, y: p1.y })

      // Add the aligned vertical segment
      mergedPath.push({ x: x2, y: y1 })
      mergedPath.push({ x: x2, y: y2 })
    }

    // Add the rest of path1 from after the stair step
    for (let i = seg1Index + 3; i < path1.length; i++) {
      mergedPath.push(path1[i])
    }

    // Add path2, but skip the stair step we're merging
    for (let i = 0; i < seg2Index; i++) {
      mergedPath.push(path2[i])
    }
    for (let i = seg2Index + 3; i < path2.length; i++) {
      mergedPath.push(path2[i])
    }

    return mergedPath
  }

  override _step() {
    // Get all nets with multiple traces
    const netsWithMultipleTraces = Array.from(this.netToTracesMap.entries())
      .filter(([_, traces]) => traces.length > 1)

    if (netsWithMultipleTraces.length === 0) {
      this.solved = true
      return
    }

    // Try to merge traces for each net
    for (const [netId, traces] of netsWithMultipleTraces) {
      // Try to merge each pair of traces
      for (let i = 0; i < traces.length; i++) {
        for (let j = i + 1; j < traces.length; j++) {
          const trace1 = traces[i]
          const trace2 = traces[j]

          // First try to merge collinear segments
          let mergedTrace = this.tryMergeTraces(trace1, trace2)

          // If that didn't work, try to merge stair-step patterns
          if (!mergedTrace) {
            mergedTrace = this.tryMergeStairStepTraces(trace1, trace2)
          }

          if (mergedTrace) {
            // Update the trace map
            this.traceMap.set(mergedTrace.mspPairId, mergedTrace)

            // Remove the old traces
            this.traceMap.delete(trace1.mspPairId)
            this.traceMap.delete(trace2.mspPairId)

            // Update the net-to-traces map
            const updatedTraces = this.netToTracesMap.get(netId)!.filter(
              t => t.mspPairId !== trace1.mspPairId && t.mspPairId !== trace2.mspPairId
            )
            updatedTraces.push(mergedTrace)
            this.netToTracesMap.set(netId, updatedTraces)

            // Update the output traces
            this.outputTraces = Array.from(this.traceMap.values())

            // We've made a change, so we'll need another iteration
            return
          }
        }
      }
    }

    // If we get here, we couldn't merge any more traces
    this.solved = true
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

    for (const trace of this.outputTraces) {
      const line = {
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "blue",
      }
      graphics.lines!.push(line)
    }

    return graphics
  }
}
