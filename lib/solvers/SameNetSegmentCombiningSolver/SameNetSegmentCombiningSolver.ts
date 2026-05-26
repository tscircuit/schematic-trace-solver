import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { Point } from "@tscircuit/math-utils"

const EPS = 1e-6
const COMBINE_THRESHOLD = 0.2

interface Endpoint {
  traceIdx: number
  isStart: boolean
  pos: Point
}

export class SameNetSegmentCombiningSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  combinedCount = 0

  constructor(params: {
    inputProblem: InputProblem
    traces: SolvedTracePath[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.traces
    this.outputTraces = params.traces.map((t) => ({
      ...t,
      tracePath: [...t.tracePath],
    }))
  }

  override _step() {
    const tracesByNet = this.groupTracesByNet()

    for (const [netId, traces] of tracesByNet) {
      if (traces.length < 2) continue
      this.combineNetSegments(netId, traces)
    }

    this.solved = true
  }

  private groupTracesByNet(): Map<string, SolvedTracePath[]> {
    const map = new Map<string, SolvedTracePath[]>()
    for (const trace of this.outputTraces) {
      const key = trace.globalConnNetId
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(trace)
    }
    return map
  }

  /**
   * Finds trace endpoints in the same net that are close together
   * and joins them into a shared junction, then cleans up redundant
   * overlap segments.
   */
  private combineNetSegments(netId: string, traces: SolvedTracePath[]) {
    if (traces.length < 2) return

    let combined = true
    let passCount = 0
    while (combined && passCount < 10) {
      combined = false
      passCount++

      combined = this.combineNearbyEndpoints(traces) || combined
    }

    for (const trace of traces) {
      trace.tracePath = this.simplifyCollinear(trace.tracePath)
    }

    this.combinedCount += combined ? 1 : 0
  }

  private combineNearbyEndpoints(traces: SolvedTracePath[]): boolean {
    const endpoints: Endpoint[] = []
    for (let ti = 0; ti < traces.length; ti++) {
      const path = traces[ti]!.tracePath
      if (path.length < 2) continue
      endpoints.push({ traceIdx: ti, isStart: true, pos: path[0]! })
      endpoints.push({
        traceIdx: ti,
        isStart: false,
        pos: path[path.length - 1]!,
      })
    }

    for (let i = 0; i < endpoints.length; i++) {
      for (let j = i + 1; j < endpoints.length; j++) {
        const a = endpoints[i]!
        const b = endpoints[j]!

        if (a.traceIdx === b.traceIdx) {
          const path = traces[a.traceIdx]!.tracePath
          if (path.length < 3) continue

          if (a.isStart && !b.isStart) {
            const dist = this.pointDist(a.pos, b.pos)
            if (dist < COMBINE_THRESHOLD) {
              const midX = (a.pos.x + b.pos.x) / 2
              const midY = (a.pos.y + b.pos.y) / 2
              path[0] = { x: midX, y: midY }
              path[path.length - 1] = { x: midX, y: midY }
              return true
            }
          }
          if (!a.isStart && b.isStart) {
            return this.combineNearbyEndpoints(traces)
          }
          continue
        }

        const dist = this.pointDist(a.pos, b.pos)
        if (dist > COMBINE_THRESHOLD) continue

        const traceA = traces[a.traceIdx]!
        const traceB = traces[b.traceIdx]!

        const pathA = traceA.tracePath
        const pathB = traceB.tracePath

        const aHasSharedEnd = a.isStart
          ? this.hasSharedWithStart(pathA)
          : this.hasSharedWithEnd(pathA)
        const bHasSharedEnd = b.isStart
          ? this.hasSharedWithStart(pathB)
          : this.hasSharedWithEnd(pathB)

        if (aHasSharedEnd || bHasSharedEnd) continue

        if (a.isStart) {
          pathA.reverse()
        }
        if (!b.isStart) {
          pathB.reverse()
        }

        const mergedPath = this.mergePathsWithoutDup(pathA, pathB)
        traceB.tracePath = mergedPath

        const newEndpoints = endpoints.filter(
          (e) => e.traceIdx === b.traceIdx,
        )
        for (const ne of newEndpoints) {
          if (ne.isStart) {
            ne.pos = mergedPath[0]!
          } else {
            ne.pos = mergedPath[mergedPath.length - 1]!
          }
        }

        traces.splice(a.traceIdx, 1)
        for (let k = 0; k < endpoints.length; k++) {
          if (endpoints[k]!.traceIdx > a.traceIdx) {
            endpoints[k]!.traceIdx--
          }
        }

        return true
      }
    }

    return false
  }

  private pointDist(a: Point, b: Point): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  private hasSharedWithStart(path: Point[]): boolean {
    if (path.length < 2) return false
    const first = path[0]!
    const second = path[1]!
    for (let i = 2; i < path.length; i++) {
      const d1 = this.pointDist(path[i]!, first)
      const d2 = this.pointDist(path[i]!, second)
      if (d1 < EPS || d2 < EPS) return true
    }
    return false
  }

  private hasSharedWithEnd(path: Point[]): boolean {
    if (path.length < 2) return false
    const last = path[path.length - 1]!
    const secondLast = path[path.length - 2]!
    for (let i = 0; i < path.length - 2; i++) {
      const d1 = this.pointDist(path[i]!, last)
      const d2 = this.pointDist(path[i]!, secondLast)
      if (d1 < EPS || d2 < EPS) return true
    }
    return false
  }

  private mergePathsWithoutDup(pathA: Point[], pathB: Point[]): Point[] {
    const overlapCount = this.countOverlappingPoints(pathA, pathB)
    if (overlapCount > 0) {
      const suffix = pathB.slice(overlapCount)
      return [...pathA, ...suffix]
    }
    return [...pathA, ...pathB]
  }

  private countOverlappingPoints(a: Point[], b: Point[]): number {
    let count = 0
    for (
      let i = a.length - 1, j = 0;
      i >= 0 && j < b.length;
      i--, j++
    ) {
      if (this.pointDist(a[i]!, b[j]!) < EPS) {
        count++
      } else {
        break
      }
    }
    return count
  }

  private simplifyCollinear(path: Point[]): Point[] {
    if (path.length < 3) return path
    const result: Point[] = [path[0]!]
    for (let i = 1; i < path.length - 1; i++) {
      const prev = result[result.length - 1]
      const curr = path[i]!
      const next = path[i + 1]!
      const allHoriz =
        Math.abs(prev.y - curr.y) < EPS && Math.abs(curr.y - next.y) < EPS
      const allVert =
        Math.abs(prev.x - curr.x) < EPS && Math.abs(curr.x - next.x) < EPS
      if (allHoriz || allVert) continue
      result.push(curr)
    }
    result.push(path[path.length - 1]!)
    return result
  }

  getOutput() {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })
    if (!graphics.lines) graphics.lines = []

    for (const trace of this.outputTraces) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "blue",
      })
    }

    return graphics
  }
}
