import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"

export interface TraceMergerSolverInput {
  allTraces: SolvedTracePath[]
  threshold?: number
}

export class TraceMergerSolver extends BaseSolver {
  private allTraces: SolvedTracePath[]
  private threshold: number
  private outputTraces: SolvedTracePath[] = []

  constructor(input: TraceMergerSolverInput) {
    super()
    this.allTraces = input.allTraces
    this.threshold = input.threshold ?? 0.01
  }

  override _step() {
    this.outputTraces = this.mergeCloseTraces(this.allTraces)
    this.solved = true
  }

  private mergeCloseTraces(traces: SolvedTracePath[]): SolvedTracePath[] {
    // Group traces by globalConnNetId
    const netGroups: Record<string, SolvedTracePath[]> = {}
    for (const trace of traces) {
      const netId = trace.globalConnNetId
      if (!netGroups[netId]) netGroups[netId] = []
      netGroups[netId].push(trace)
    }

    const outputTraces: SolvedTracePath[] = []

    for (const [netId, groupTraces] of Object.entries(netGroups)) {
      // Collect all segments in this net
      const allPoints = groupTraces.flatMap((t) => t.tracePath)
      
      // Snap points to common coordinates within the net
      for (let i = 0; i < allPoints.length; i++) {
        const p1 = allPoints[i]
        for (let j = i + 1; j < allPoints.length; j++) {
          const p2 = allPoints[j]
          
          if (Math.abs(p1.x - p2.x) < this.threshold) {
            // Keep the first one's X
            p2.x = p1.x
          }
          if (Math.abs(p1.y - p2.y) < this.threshold) {
            // Keep the first one's Y
            p2.y = p1.y
          }
        }
      }

      // Simplify each trace path in the group after snapping
      for (const trace of groupTraces) {
        outputTraces.push({
          ...trace,
          tracePath: this.mergePathSegments(trace.tracePath),
        })
      }
    }

    return outputTraces
  }

  private mergePathSegments(path: Point[]): Point[] {
    if (path.length < 3) return path

    let points = [...path]

    // Step 1: Snap nearly collinear segments
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i]
      const p2 = points[i + 1]

      for (let j = i + 1; j < points.length - 1; j++) {
        const p3 = points[j]
        const p4 = points[j + 1]

        // Check horizontal snap
        if (
          Math.abs(p1.y - p2.y) < 1e-9 &&
          Math.abs(p3.y - p4.y) < 1e-9 &&
          Math.abs(p1.y - p3.y) < this.threshold
        ) {
          p3.y = p1.y
          p4.y = p1.y
        }

        // Check vertical snap
        if (
          Math.abs(p1.x - p2.x) < 1e-9 &&
          Math.abs(p3.x - p4.x) < 1e-9 &&
          Math.abs(p1.x - p3.x) < this.threshold
        ) {
          p3.x = p1.x
          p4.x = p1.x
        }
      }
    }

    // Step 2: Merge collinear segments
    const simplified: Point[] = [points[0]]
    for (let i = 1; i < points.length - 1; i++) {
      const pPrev = simplified[simplified.length - 1]
      const pCurr = points[i]
      const pNext = points[i + 1]

      const isVertical = Math.abs(pPrev.x - pCurr.x) < 1e-9 && Math.abs(pCurr.x - pNext.x) < 1e-9
      const isHorizontal = Math.abs(pPrev.y - pCurr.y) < 1e-9 && Math.abs(pCurr.y - pNext.y) < 1e-9

      if (!isVertical && !isHorizontal) {
        simplified.push(pCurr)
      }
    }
    simplified.push(points[points.length - 1])

    return simplified
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }
}
