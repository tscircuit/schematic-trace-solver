import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"

export interface SameNetTraceMergeSolverParams {
  traces: SolvedTracePath[]
}

export class SameNetTraceMergeSolver extends BaseSolver {
  traces: SolvedTracePath[]
  mergedTraces: SolvedTracePath[] = []

  constructor(params: SameNetTraceMergeSolverParams) {
    super()
    this.traces = params.traces
  }

  override _step() {
    this.mergedTraces = this.mergeTraces(this.traces)
    this.solved = true
  }

  public getOutput() {
    return {
      traces: this.mergedTraces,
    }
  }

  private mergeTraces(traces: SolvedTracePath[]): SolvedTracePath[] {
    if (traces.length === 0) return []

    // Group traces by globalConnNetId
    const netGroups: Record<string, SolvedTracePath[]> = {}
    for (const trace of traces) {
      const netId = trace.globalConnNetId
      if (!netGroups[netId]) {
        netGroups[netId] = []
      }
      netGroups[netId].push(trace)
    }

    const allMergedTraces: SolvedTracePath[] = []

    for (const netId in netGroups) {
      const mergedForNet = this.mergeTracesForNet(netGroups[netId])
      allMergedTraces.push(...mergedForNet)
    }

    return allMergedTraces
  }

  private mergeTracesForNet(netTraces: SolvedTracePath[]): SolvedTracePath[] {
    let currentTraces = [...netTraces]
    let mergedAny = true

    while (mergedAny) {
      mergedAny = false
      const nextTraces: SolvedTracePath[] = []
      const usedIndices = new Set<number>()

      for (let i = 0; i < currentTraces.length; i++) {
        if (usedIndices.has(i)) continue

        let mergedTrace = { ...currentTraces[i] }
        usedIndices.add(i)

        for (let j = 0; j < currentTraces.length; j++) {
          if (usedIndices.has(j)) continue

          const otherTrace = currentTraces[j]
          const joinResult = this.tryJoinPaths(mergedTrace.tracePath, otherTrace.tracePath)

          if (joinResult) {
            mergedTrace.tracePath = joinResult
            mergedTrace.mspConnectionPairIds = Array.from(
              new Set([...mergedTrace.mspConnectionPairIds, ...otherTrace.mspConnectionPairIds])
            )
            mergedTrace.pinIds = Array.from(
              new Set([...mergedTrace.pinIds, ...otherTrace.pinIds])
            )
            usedIndices.add(j)
            mergedAny = true
            // Restart inner loop to try merging more into this trace
            j = -1 
          }
        }
        nextTraces.push(mergedTrace)
      }
      currentTraces = nextTraces
    }

    // After joining paths, simplify each path by removing collinear points
    return currentTraces.map(t => ({
      ...t,
      tracePath: this.simplifyCollinearPoints(t.tracePath)
    }))
  }

  private tryJoinPaths(p1: Point[], p2: Point[]): Point[] | null {
    const threshold = 0.001
    const dist = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)

    // End of p1 to Start of p2
    if (dist(p1[p1.length - 1], p2[0]) < threshold) {
      return [...p1, ...p2.slice(1)]
    }
    // Start of p1 to End of p2
    if (dist(p1[0], p2[p2.length - 1]) < threshold) {
      return [...p2, ...p1.slice(1)]
    }
    // End of p1 to End of p2
    if (dist(p1[p1.length - 1], p2[p2.length - 1]) < threshold) {
      return [...p1, ...[...p2].reverse().slice(1)]
    }
    // Start of p1 to Start of p2
    if (dist(p1[0], p2[0]) < threshold) {
      return [...[...p1].reverse(), ...p2.slice(1)]
    }

    return null
  }

  private simplifyCollinearPoints(points: Point[]): Point[] {
    if (points.length <= 2) return points

    const simplified: Point[] = [points[0]]
    const threshold = 0.001

    for (let i = 1; i < points.length - 1; i++) {
      const prev = simplified[simplified.length - 1]
      const curr = points[i]
      const next = points[i + 1]

      const isCollinear = this.areCollinear(prev, curr, next, threshold)
      if (!isCollinear) {
        simplified.push(curr)
      }
    }

    simplified.push(points[points.length - 1])
    return simplified
  }

  private areCollinear(p1: Point, p2: Point, p3: Point, threshold: number): boolean {
    // Area of triangle = 0.5 * |x1(y2-y3) + x2(y3-y1) + x3(y1-y2)|
    // Using area / distance as a measure of collinearity
    const area = Math.abs(p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y))
    return area < threshold
  }
}
