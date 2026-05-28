import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"

export interface TraceSegmentCombinerSolverParams {
  inputProblem: InputProblem
  allTraces: SolvedTracePath[]
}

export class TraceSegmentCombinerSolver extends BaseSolver {
  inputProblem: InputProblem
  allTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]

  constructor(params: TraceSegmentCombinerSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.allTraces = params.allTraces
    this.outputTraces = JSON.parse(JSON.stringify(params.allTraces))
  }

  override _step() {
    this.combineSameNetTraces()
    this.solved = true
  }

  private combineSameNetTraces() {
    const EPS = 0.1001 // Distance threshold for "close together"
    const netGroups: Record<string, SolvedTracePath[]> = {}

    for (const trace of this.outputTraces) {
      const netId = trace.globalConnNetId
      if (!netGroups[netId]) netGroups[netId] = []
      netGroups[netId].push(trace)
    }

    for (const netId in netGroups) {
      const paths = netGroups[netId]!
      if (paths.length < 2) continue

      let changed = true
      while (changed) {
        changed = false
        for (let i = 0; i < paths.length; i++) {
          for (let j = 0; j < paths.length; j++) {
            if (i === j) continue
            if (this.tryCombinePaths(paths[i]!, paths[j]!, EPS)) {
              changed = true
            }
          }
        }
      }
    }

    // Final simplification pass
    for (const trace of this.outputTraces) {
      trace.tracePath = simplifyPath(trace.tracePath)
    }
  }

  private tryCombinePaths(
    pathA: SolvedTracePath,
    pathB: SolvedTracePath,
    eps: number,
  ): boolean {
    let changed = false
    const ptsA = pathA.tracePath
    const ptsB = pathB.tracePath

    for (let i = 0; i < ptsA.length - 1; i++) {
      const a1 = ptsA[i]!
      const a2 = ptsA[i + 1]!
      const aVert = Math.abs(a1.x - a2.x) < 1e-6
      const aHorz = Math.abs(a1.y - a2.y) < 1e-6
      if (!aVert && !aHorz) continue

      for (let j = 0; j < ptsB.length - 1; j++) {
        const b1 = ptsB[j]!
        const b2 = ptsB[j + 1]!
        const bVert = Math.abs(b1.x - b2.x) < 1e-6
        const bHorz = Math.abs(b1.y - b2.y) < 1e-6
        if (!bVert && !bHorz) continue

        if (aVert && bVert) {
          // Both vertical, check if they are close in X and overlap in Y
          const dx = Math.abs(a1.x - b1.x)
          if (dx > 0 && dx < eps) {
            if (this.segmentsOverlap1D(a1.y, a2.y, b1.y, b2.y)) {
              // Snap B's segments to A's X
              this.snapSegmentX(pathB, j, a1.x)
              changed = true
            }
          }
        } else if (aHorz && bHorz) {
          // Both horizontal, check if they are close in Y and overlap in X
          const dy = Math.abs(a1.y - b1.y)
          if (dy > 0 && dy < eps) {
            if (this.segmentsOverlap1D(a1.x, a2.x, b1.x, b2.x)) {
              // Snap B's segments to A's Y
              this.snapSegmentY(pathB, j, a1.y)
              changed = true
            }
          }
        }
      }
    }
    return changed
  }

  private segmentsOverlap1D(
    a1: number,
    a2: number,
    b1: number,
    b2: number,
  ): boolean {
    const minA = Math.min(a1, a2)
    const maxA = Math.max(a1, a2)
    const minB = Math.min(b1, b2)
    const maxB = Math.max(b1, b2)
    return Math.max(minA, minB) < Math.min(maxA, maxB) - 1e-6
  }

  private snapSegmentX(path: SolvedTracePath, segIdx: number, newX: number) {
    path.tracePath[segIdx]!.x = newX
    path.tracePath[segIdx + 1]!.x = newX
  }

  private snapSegmentY(path: SolvedTracePath, segIdx: number, newY: number) {
    path.tracePath[segIdx]!.y = newY
    path.tracePath[segIdx + 1]!.y = newY
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize() {
    const graphics = visualizeInputProblem(this.inputProblem)
    for (const trace of this.outputTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "blue",
      })
    }
    return graphics
  }
}
