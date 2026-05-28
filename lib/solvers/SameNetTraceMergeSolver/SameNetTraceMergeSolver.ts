import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject } from "graphics-debug"

/**
 * Distance threshold (in schematic units) below which two same-net trace
 * endpoints are considered "close enough" to merge.
 */
const MERGE_THRESHOLD = 0.4

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

export interface SameNetTraceMergeSolverParams {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
}

/**
 * Pipeline phase that combines same-net trace segments whose endpoints are
 * close together into a single continuous path.
 *
 * Runs iteratively: each step finds one mergeable pair and merges it, then
 * repeats until no more merges are possible.
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  outputTraces: SolvedTracePath[]

  constructor(params: SameNetTraceMergeSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.outputTraces = [...params.traces]
  }

  override _step() {
    const tracesByNet = new Map<string, SolvedTracePath[]>()
    for (const trace of this.outputTraces) {
      const netId = trace.globalConnNetId
      if (!tracesByNet.has(netId)) tracesByNet.set(netId, [])
      tracesByNet.get(netId)!.push(trace)
    }

    for (const traces of tracesByNet.values()) {
      if (traces.length < 2) continue

      const merged = this.tryMergeAnyPair(traces)
      if (merged) return // restart next step after mutation
    }

    this.solved = true
  }

  /**
   * Tries to find a pair of traces whose endpoints are within MERGE_THRESHOLD
   * and merges them. Returns true if a merge was performed.
   */
  private tryMergeAnyPair(traces: SolvedTracePath[]): boolean {
    for (let i = 0; i < traces.length; i++) {
      for (let j = i + 1; j < traces.length; j++) {
        const a = traces[i]
        const b = traces[j]

        const aStart = a.tracePath[0]
        const aEnd = a.tracePath[a.tracePath.length - 1]
        const bStart = b.tracePath[0]
        const bEnd = b.tracePath[b.tracePath.length - 1]

        // Check all four endpoint combinations
        const candidates = [
          { dAB: dist(aEnd, bStart), reverseA: false, reverseB: false },
          { dAB: dist(aEnd, bEnd), reverseA: false, reverseB: true },
          { dAB: dist(aStart, bStart), reverseA: true, reverseB: false },
          { dAB: dist(aStart, bEnd), reverseA: true, reverseB: true },
        ]

        const best = candidates.reduce((min, c) => (c.dAB < min.dAB ? c : min))

        if (best.dAB > MERGE_THRESHOLD) continue

        const pathA = best.reverseA
          ? [...a.tracePath].reverse()
          : [...a.tracePath]
        const pathB = best.reverseB
          ? [...b.tracePath].reverse()
          : [...b.tracePath]

        const mergedTrace: SolvedTracePath = {
          ...a,
          tracePath: [...pathA, ...pathB],
          mspConnectionPairIds: [
            ...a.mspConnectionPairIds,
            ...b.mspConnectionPairIds,
          ],
          pinIds: [...a.pinIds, ...b.pinIds],
        }

        this.outputTraces = this.outputTraces.filter((t) => t !== a && t !== b)
        this.outputTraces.push(mergedTrace)
        return true
      }
    }
    return false
  }

  getOutput() {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    return {
      lines: this.outputTraces.flatMap((trace) => {
        const pts = trace.tracePath
        return pts.slice(0, -1).map((pt, idx) => ({
          points: [pt, pts[idx + 1]],
          strokeColor: "blue",
        }))
      }),
    }
  }
}
