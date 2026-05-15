import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { ConnectivityMap } from "connectivity-map"

interface MergeSameNetTracesSolverInput {
  allTraces: SolvedTracePath[]
  globalConnMap: ConnectivityMap
}

/**
 * Merges trace line segments that belong to the same net and are close together.
 * 
 * When two traces share the same net and have parallel segments near each other,
 * this solver merges them to the same X (for vertical) or Y (for horizontal)
 * coordinate, reducing visual clutter and improving schematic readability.
 */
export class MergeSameNetTracesSolver extends BaseSolver {
  private input: MergeSameNetTracesSolverInput
  output: SolvedTracePath[]

  constructor(input: MergeSameNetTracesSolverInput) {
    super()
    this.input = input
    this.output = [...input.allTraces]
  }

  /**
   * Check if two trace paths belong to the same net
   */
  private areSameNet(traceA: SolvedTracePath, traceB: SolvedTracePath): boolean {
    const connMap = this.input.globalConnMap
    return connMap.areConnected(traceA.mspPairId, traceB.mspPairId)
  }

  /**
   * Find parallel segments within MERGE_DISTANCE of each other
   */
  private findCloseParallelSegments(tracePath: { x: number; y: number }[]) {
    const segments: Array<{
      ax: number; ay: number; bx: number; by: number
      horizontal: boolean
      y: number
    }> = []

    for (let i = 0; i < tracePath.length - 1; i++) {
      const a = tracePath[i], b = tracePath[i + 1]
      const horizontal = Math.abs(a.y - b.y) < 0.001
      if (horizontal) {
        segments.push({
          ax: a.x, ay: a.y, bx: b.x, by: b.y,
          horizontal: true,
          y: a.y,
        })
      } else {
        segments.push({
          ax: a.x, ay: a.y, bx: b.x, by: b.y,
          horizontal: false,
          y: a.x,
        })
      }
    }
    return segments
  }

  override _step() {
    const MERGE_DISTANCE = 0.3
    let merged = false

    for (let i = 0; i < this.output.length; i++) {
      for (let j = i + 1; j < this.output.length; j++) {
        if (!this.areSameNet(this.output[i], this.output[j])) continue

        const segsA = this.findCloseParallelSegments(this.output[i].tracePath)
        const segsB = this.findCloseParallelSegments(this.output[j].tracePath)

        for (const segA of segsA) {
          for (const segB of segsB) {
            if (segA.horizontal !== segB.horizontal) continue

            const dist = Math.abs(segA.y - segB.y)
            if (dist > MERGE_DISTANCE) continue

            // Check overlap in the parallel axis
            const aMin = Math.min(segA.ax, segA.bx)
            const aMax = Math.max(segA.ax, segA.bx)
            const bMin = Math.min(segB.ax, segB.bx)
            const bMax = Math.max(segB.ax, segB.bx)

            const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin)
            if (overlap < 0) continue

            // Merge: shift segB to segA's Y coordinate
            const avgY = (segA.y + segB.y) / 2
            if (segA.horizontal) {
              // Find and update the y of both segments to the midpoint
              for (let k = 0; k < this.output[i].tracePath.length - 1; k++) {
                const p = this.output[i].tracePath[k]
                const n = this.output[i].tracePath[k + 1]
                if (Math.abs(p.y - segA.y) < 0.001 && Math.abs(n.y - segA.y) < 0.001) {
                  p.y = avgY
                  n.y = avgY
                }
              }
              for (let k = 0; k < this.output[j].tracePath.length - 1; k++) {
                const p = this.output[j].tracePath[k]
                const n = this.output[j].tracePath[k + 1]
                if (Math.abs(p.y - segB.y) < 0.001 && Math.abs(n.y - segB.y) < 0.001) {
                  p.y = avgY
                  n.y = avgY
                }
              }
            } else {
              // Vertical: shift X coordinate
              for (let k = 0; k < this.output[i].tracePath.length - 1; k++) {
                const p = this.output[i].tracePath[k]
                const n = this.output[i].tracePath[k + 1]
                if (Math.abs(p.x - segA.y) < 0.001 && Math.abs(n.x - segA.y) < 0.001) {
                  p.x = avgY
                  n.x = avgY
                }
              }
              for (let k = 0; k < this.output[j].tracePath.length - 1; k++) {
                const p = this.output[j].tracePath[k]
                const n = this.output[j].tracePath[k + 1]
                if (Math.abs(p.x - segB.y) < 0.001 && Math.abs(n.x - segB.y) < 0.001) {
                  p.x = avgY
                  n.x = avgY
                }
              }
            }
            merged = true
          }
        }
      }
    }

    this.solved = true
  }

  getOutput() {
    return { traces: this.output }
  }
}
