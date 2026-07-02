import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject, Line } from "graphics-debug"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"

export class SameNetTraceMergeSolver extends BaseSolver {
  private inputProblem: InputProblem
  private outputTraces: SolvedTracePath[]

  constructor(params: {
    inputProblem: InputProblem
    traces: SolvedTracePath[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.outputTraces = [...params.traces]
  }

  override _step() {
    const tracesByNet: Record<string, SolvedTracePath[]> = {}
    for (const trace of this.outputTraces) {
      const netId = trace.globalConnNetId
      if (!tracesByNet[netId]) tracesByNet[netId] = []
      tracesByNet[netId].push(trace)
    }

    const newTraces: SolvedTracePath[] = []
    for (const netId in tracesByNet) {
      const netTraces = tracesByNet[netId]
      newTraces.push(...this._mergeTracesInNet(netTraces))
    }
    this.outputTraces = newTraces
    this.solved = true
  }

  private _mergeTracesInNet(netTraces: SolvedTracePath[]): SolvedTracePath[] {
    if (netTraces.length <= 1) return netTraces

    let merged = true
    const currentTraces = [...netTraces]

    while (merged) {
      merged = false
      for (let i = 0; i < currentTraces.length; i++) {
        for (let j = i + 1; j < currentTraces.length; j++) {
          const t1 = currentTraces[i]
          const t2 = currentTraces[j]

          const p1Start = t1.tracePath[0]
          const p1End = t1.tracePath[t1.tracePath.length - 1]
          const p2Start = t2.tracePath[0]
          const p2End = t2.tracePath[t2.tracePath.length - 1]

          const arePointsEqual = (a: Point, b: Point) =>
            Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6

          let newPath: Point[] | null = null
          if (arePointsEqual(p1End, p2Start)) {
            newPath = [...t1.tracePath, ...t2.tracePath.slice(1)]
          } else if (arePointsEqual(p1End, p2End)) {
            newPath = [...t1.tracePath, ...[...t2.tracePath].reverse().slice(1)]
          } else if (arePointsEqual(p1Start, p2Start)) {
            newPath = [...[...t1.tracePath].reverse(), ...t2.tracePath.slice(1)]
          } else if (arePointsEqual(p1Start, p2End)) {
            newPath = [...t2.tracePath, ...t1.tracePath.slice(1)]
          }

          if (newPath) {
            const newTrace: SolvedTracePath = {
              ...t1,
              tracePath: simplifyPath(newPath),
              mspConnectionPairIds: [
                ...t1.mspConnectionPairIds,
                ...t2.mspConnectionPairIds,
              ],
              pinIds: Array.from(new Set([...t1.pinIds, ...t2.pinIds])),
            }
            currentTraces.splice(j, 1)
            currentTraces[i] = newTrace
            merged = true
            break
          }
        }
        if (merged) break
      }
    }
    return currentTraces
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    if (!graphics.lines) graphics.lines = []

    for (const trace of this.outputTraces) {
      const line: Line = {
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "blue",
      }
      graphics.lines!.push(line)
    }
    return graphics
  }
}
