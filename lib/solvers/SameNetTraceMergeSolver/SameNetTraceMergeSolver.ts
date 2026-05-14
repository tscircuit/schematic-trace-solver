import type { Point } from "@tscircuit/math-utils"
import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export interface SameNetTraceMergeSolverParams {
  traces: SolvedTracePath[]
  maxEndpointGap?: number
}

function euclidean(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function getNetKey(trace: SolvedTracePath): string {
  return trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId
}

function dedupeConsecutivePoints(pts: Point[]): Point[] {
  const result: Point[] = []
  for (const pt of pts) {
    const last = result[result.length - 1]
    if (
      !last ||
      Math.abs(last.x - pt.x) > 1e-9 ||
      Math.abs(last.y - pt.y) > 1e-9
    ) {
      result.push(pt)
    }
  }
  return result
}

/**
 * Attempt to join two same-net traces by connecting their closest endpoint pair.
 * If the endpoints are not axis-aligned, a single L-turn bridge is inserted.
 */
function tryJoinByEndpoint(
  a: SolvedTracePath,
  b: SolvedTracePath,
  maxGap: number,
): SolvedTracePath | null {
  const pa = a.tracePath
  const pb = b.tracePath
  if (pa.length === 0 || pb.length === 0) return null

  const aStart = pa[0]!
  const aEnd = pa[pa.length - 1]!
  const bStart = pb[0]!
  const bEnd = pb[pb.length - 1]!

  const candidates = [
    { d: euclidean(aEnd, bStart), aRev: false, bRev: false },
    { d: euclidean(aEnd, bEnd), aRev: false, bRev: true },
    { d: euclidean(aStart, bStart), aRev: true, bRev: false },
    { d: euclidean(aStart, bEnd), aRev: true, bRev: true },
  ]
  const best = candidates.reduce((prev, curr) =>
    curr.d < prev.d ? curr : prev,
  )
  if (best.d > maxGap) return null

  const orderedA = best.aRev ? [...pa].reverse() : [...pa]
  const orderedB = best.bRev ? [...pb].reverse() : [...pb]

  const from = orderedA[orderedA.length - 1]!
  const to = orderedB[0]!
  const bridge: Point[] =
    Math.abs(from.x - to.x) > 1e-9 && Math.abs(from.y - to.y) > 1e-9
      ? [{ x: to.x, y: from.y }]
      : []

  const mergedPath = dedupeConsecutivePoints([
    ...orderedA,
    ...bridge,
    ...orderedB,
  ])

  return {
    ...a,
    mspPairId: `merged-${a.mspPairId}+${b.mspPairId}`,
    tracePath: mergedPath,
    mspConnectionPairIds: [...a.mspConnectionPairIds, ...b.mspConnectionPairIds],
    pinIds: [...a.pinIds, ...b.pinIds],
  }
}

export class SameNetTraceMergeSolver extends BaseSolver {
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  maxEndpointGap: number

  constructor({ traces, maxEndpointGap = 0.12 }: SameNetTraceMergeSolverParams) {
    super()
    this.inputTraces = [...traces]
    this.outputTraces = [...traces]
    this.maxEndpointGap = maxEndpointGap
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: this.outputTraces }
  }

  override _step() {
    const byNet = new Map<string, SolvedTracePath[]>()
    for (const trace of this.outputTraces) {
      const key = getNetKey(trace)
      if (!byNet.has(key)) byNet.set(key, [])
      byNet.get(key)!.push(trace)
    }

    for (const [, group] of byNet) {
      if (group.length < 2) continue
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const merged = tryJoinByEndpoint(
            group[i]!,
            group[j]!,
            this.maxEndpointGap,
          )
          if (merged) {
            this.outputTraces = [
              ...this.outputTraces.filter(
                (t) => t !== group[i] && t !== group[j],
              ),
              merged,
            ]
            return
          }
        }
      }
    }

    this.solved = true
  }
}
