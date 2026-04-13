import type { Point } from "graphics-debug"
import { simplifyPath } from "./simplifyPath"

export type TraceCleanupInput = {
  chips: any[]
  labels: any[]
  allTraces: { id: string; mspPairId?: string; tracePath: Point[] }[]
}

export class TraceCleanupSolver {
  private input: TraceCleanupInput

  constructor(input: TraceCleanupInput) {
    this.input = input
  }

  solve() {
    console.log(">>> TRACE CLEANUP SOLVER AVVIATO <<<")

    if (!this.input.allTraces) {
      return { cleanedTraces: [] }
    }

    const cleanedTraces = this.input.allTraces.map((trace) => {
      const original = trace.tracePath
      const cleaned = simplifyPath(original)

      return {
        id: trace.id,
        original,
        cleaned,
      }
    })

    return { cleanedTraces }
  }
}
