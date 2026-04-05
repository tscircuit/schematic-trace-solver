import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { ConnectivityMap } from "connectivity-map"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import type { GraphicsObject, Line } from "graphics-debug"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"

type ConnNetId = string

/**
 * TraceCombineSolver finds same-net trace segments that are parallel and close
 * together (or overlapping) and merges them into a single segment to simplify
 * the routing and improve aesthetics.
 */
export class TraceCombineSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: Array<SolvedTracePath>
  globalConnMap: ConnectivityMap
  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}
  traceNetIslands: Record<ConnNetId, Array<SolvedTracePath>> = {}

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
      this.correctedTraceMap[tracePath.mspPairId] = tracePath
    }

    this.traceNetIslands = this.computeTraceNetIslands()
  }

  computeTraceNetIslands(): Record<ConnNetId, Array<SolvedTracePath>> {
    const islands: Record<ConnNetId, Array<SolvedTracePath>> = {}
    for (const original of Object.values(this.correctedTraceMap)) {
      const key: ConnNetId = original.globalConnNetId
      if (!islands[key]) islands[key] = []
      islands[key].push(original)
    }
    return islands
  }

  override _step() {
    const COMBINE_THRESHOLD = 0.1
    const EPS = 1e-6
    let anyChanges = false

    for (const [netId, traces] of Object.entries(this.traceNetIslands)) {
      const horizontalSegments: Array<{
        y: number
        x1: number
        x2: number
        traceId: string
        segmentIndex: number
      }> = []
      const verticalSegments: Array<{
        x: number
        y1: number
        y2: number
        traceId: string
        segmentIndex: number
      }> = []

      // Collect all segments for this net
      for (const trace of traces) {
        for (let i = 0; i < trace.tracePath.length - 1; i++) {
          const p1 = trace.tracePath[i]!
          const p2 = trace.tracePath[i + 1]!
          if (Math.abs(p1.y - p2.y) < EPS) {
            horizontalSegments.push({
              y: p1.y,
              x1: Math.min(p1.x, p2.x),
              x2: Math.max(p1.x, p2.x),
              traceId: trace.mspPairId,
              segmentIndex: i,
            })
          } else if (Math.abs(p1.x - p2.x) < EPS) {
            verticalSegments.push({
              x: p1.x,
              y1: Math.min(p1.y, p2.y),
              y2: Math.max(p1.y, p2.y),
              traceId: trace.mspPairId,
              segmentIndex: i,
            })
          }
        }
      }

      // Find close parallel horizontal segments and snap them
      for (let i = 0; i < horizontalSegments.length; i++) {
        for (let j = i + 1; j < horizontalSegments.length; j++) {
          const s1 = horizontalSegments[i]!
          const s2 = horizontalSegments[j]!
          if (Math.abs(s1.y - s2.y) < COMBINE_THRESHOLD && Math.abs(s1.y - s2.y) > EPS) {
            // Check if they overlap in X
            const overlapX = Math.min(s1.x2, s2.x2) - Math.max(s1.x1, s2.x1)
            if (overlapX > 0) {
              this.snapSegment(s2.traceId, s2.segmentIndex, "y", s1.y)
              anyChanges = true
              // Refresh segments and restart (simplest for now)
              this.traceNetIslands = this.computeTraceNetIslands()
              return
            }
          }
        }
      }

      // Find close parallel vertical segments and snap them
      for (let i = 0; i < verticalSegments.length; i++) {
        for (let j = i + 1; j < verticalSegments.length; j++) {
          const s1 = verticalSegments[i]!
          const s2 = verticalSegments[j]!
          if (Math.abs(s1.x - s2.x) < COMBINE_THRESHOLD && Math.abs(s1.x - s2.x) > EPS) {
            // Check if they overlap in Y
            const overlapY = Math.min(s1.y2, s2.y2) - Math.max(s1.y1, s2.y1)
            if (overlapY > 0) {
              this.snapSegment(s2.traceId, s2.segmentIndex, "x", s1.x)
              anyChanges = true
              this.traceNetIslands = this.computeTraceNetIslands()
              return
            }
          }
        }
      }
    }

    if (!anyChanges) {
      // Final pass: simplify all paths
      for (const [traceId, trace] of Object.entries(this.correctedTraceMap)) {
        this.correctedTraceMap[traceId] = {
          ...trace,
          tracePath: simplifyPath(trace.tracePath),
        }
      }
      this.solved = true
    }
  }

  private snapSegment(traceId: string, segmentIndex: number, axis: "x" | "y", value: number) {
    const trace = this.correctedTraceMap[traceId]!
    const newPath = [...trace.tracePath]
    const p1 = newPath[segmentIndex]!
    const p2 = newPath[segmentIndex + 1]!

    if (axis === "y") {
      p1.y = value
      p2.y = value
    } else {
      p1.x = value
      p2.x = value
    }

    // After snapping, we might have created "non-orthogonal" connections from the neighbor segments
    // But they will be fixed in the next snap if they were already horizontal/vertical
    // If not, they might become diagonal and need fixing.
    // Actually, snapping horizontal segments to same Y maintains orthogonality for the neighbors 
    // IF the neighbors were vertical.
    
    this.correctedTraceMap[traceId] = {
      ...trace,
      tracePath: newPath,
    }
  }

  getOutput() {
    return {
      traces: Object.values(this.correctedTraceMap),
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    if (!graphics.lines) graphics.lines = []
    
    for (const trace of Object.values(this.correctedTraceMap)) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "green",
        strokeWidth: 0.02,
      })
    }

    return graphics
  }
}
