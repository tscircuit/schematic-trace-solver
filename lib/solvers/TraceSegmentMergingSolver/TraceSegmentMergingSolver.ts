import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * TraceSegmentMergingSolver implements a pipeline phase that combines trace segments
 * belonging to the same net that are physically close or touching.
 * It also simplifies paths by removing redundant points.
 */
export class TraceSegmentMergingSolver extends BaseSolver {
  private allTraces: SolvedTracePath[]
  private inputProblem: InputProblem
  private mergingThreshold: number
  private outputTraces: SolvedTracePath[] = []

  constructor(params: {
    allTraces: SolvedTracePath[]
    inputProblem: InputProblem
    mergingThreshold?: number
  }) {
    super()
    this.allTraces = params.allTraces
    this.inputProblem = params.inputProblem
    this.mergingThreshold = params.mergingThreshold ?? 0.1
  }

  override _step() {
    // 1. Group traces by net (using globalConnNetId)
    const netGroups = new Map<string, SolvedTracePath[]>()
    for (const trace of this.allTraces) {
      const netId = trace.globalConnNetId || "default"
      if (!netGroups.has(netId)) {
        netGroups.set(netId, [])
      }
      netGroups.get(netId)!.push(trace)
    }

    // 2. For each net, merge segments
    for (const [netId, traces] of netGroups.entries()) {
      const mergedTracesForNet = this.mergePathsForNet(traces)
      this.outputTraces.push(...mergedTracesForNet)
    }

    this.solved = true
  }

  private mergePathsForNet(traces: SolvedTracePath[]): SolvedTracePath[] {
    if (traces.length <= 1) return traces

    let currentTraces = [...traces]
    let changed = true

    while (changed) {
      changed = false
      const nextIterationTraces: SolvedTracePath[] = []
      const mergedIndices = new Set<number>()

      for (let i = 0; i < currentTraces.length; i++) {
        if (mergedIndices.has(i)) continue

        let mergedAny = false
        for (let j = i + 1; j < currentTraces.length; j++) {
          if (mergedIndices.has(j)) continue

          const mergedPath = this.tryMerge(currentTraces[i], currentTraces[j])
          if (mergedPath) {
            nextIterationTraces.push(mergedPath)
            mergedIndices.add(i)
            mergedIndices.add(j)
            mergedAny = true
            changed = true
            break
          }
        }

        if (!mergedAny) {
          nextIterationTraces.push(currentTraces[i])
        }
      }
      currentTraces = nextIterationTraces
    }

    // Finally, simplify all paths
    return currentTraces.map((t) => ({
      ...t,
      tracePath: this.simplifyPath(t.tracePath),
    }))
  }

  private tryMerge(
    a: SolvedTracePath,
    b: SolvedTracePath,
  ): SolvedTracePath | null {
    const pAStart = a.tracePath[0]
    const pAEnd = a.tracePath[a.tracePath.length - 1]
    const pBStart = b.tracePath[0]
    const pBEnd = b.tracePath[b.tracePath.length - 1]

    const dist = (p1: Point, p2: Point) =>
      Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2))

    // Check all combinations of endpoints
    // A_End to B_Start
    if (dist(pAEnd, pBStart) < this.mergingThreshold) {
      return this.createCombinedTrace(a, b, [...a.tracePath, ...b.tracePath])
    }
    // B_End to A_Start
    if (dist(pBEnd, pAStart) < this.mergingThreshold) {
      return this.createCombinedTrace(a, b, [...b.tracePath, ...a.tracePath])
    }
    // A_Start to B_Start (Reverse B)
    if (dist(pAStart, pBStart) < this.mergingThreshold) {
      return this.createCombinedTrace(a, b, [
        ...[...a.tracePath].reverse(),
        ...b.tracePath,
      ])
    }
    // A_End to B_End (Reverse B)
    if (dist(pAEnd, pBEnd) < this.mergingThreshold) {
      return this.createCombinedTrace(a, b, [
        ...a.tracePath,
        ...[...b.tracePath].reverse(),
      ])
    }

    return null
  }

  private createCombinedTrace(
    a: SolvedTracePath,
    b: SolvedTracePath,
    newPath: Point[],
  ): SolvedTracePath {
    return {
      ...a,
      tracePath: newPath,
      mspConnectionPairIds: [
        ...(a.mspConnectionPairIds || []),
        ...(b.mspConnectionPairIds || []),
      ],
      pinIds: [...new Set([...(a.pinIds || []), ...(b.pinIds || [])])],
    }
  }

  private simplifyPath(points: Point[]): Point[] {
    if (points.length <= 2) return points

    const simplified: Point[] = [points[0]]
    for (let i = 1; i < points.length - 1; i++) {
      const prev = simplified[simplified.length - 1]
      const curr = points[i]
      const next = points[i + 1]

      if (!this.areCollinear(prev, curr, next)) {
        simplified.push(curr)
      }
    }
    simplified.push(points[points.length - 1])
    return simplified
  }

  private areCollinear(p1: Point, p2: Point, p3: Point): boolean {
    const threshold = 1e-6
    // Use the slope-based collinearity or cross-product (for numerical stability)
    const area = Math.abs(
      p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y),
    )
    return area < threshold
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }
}
