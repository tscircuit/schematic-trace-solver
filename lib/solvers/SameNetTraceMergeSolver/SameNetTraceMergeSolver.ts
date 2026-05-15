import type { Point } from "@tscircuit/math-utils"
import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export interface SameNetTraceMergeSolverParams {
  traces: SolvedTracePath[]
  /**
   * Maximum distance between two trace endpoints to consider them mergeable.
   * Default: 0.12 units.
   */
  maxEndpointGap?: number
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Net key for grouping – prefer user-defined net id, fall back to connectivity ids */
function netKey(trace: SolvedTracePath): string {
  return trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId
}

/** Remove exact duplicate consecutive points */
function dedupe(pts: Point[]): Point[] {
  const out: Point[] = []
  for (const p of pts) {
    const prev = out[out.length - 1]
    if (!prev || Math.abs(prev.x - p.x) > 1e-9 || Math.abs(prev.y - p.y) > 1e-9) {
      out.push(p)
    }
  }
  return out
}

/**
 * Try to merge two same-net traces by finding the closest endpoint pair.
 * If the join requires a direction change, a single right-angle bridge is inserted.
 * Returns the merged SolvedTracePath or null if the gap exceeds maxGap.
 */
function tryMerge(
  a: SolvedTracePath,
  b: SolvedTracePath,
  maxGap: number,
): SolvedTracePath | null {
  const pa = a.tracePath
  const pb = b.tracePath
  if (pa.length === 0 || pb.length === 0) return null

  const aS = pa[0]!
  const aE = pa[pa.length - 1]!
  const bS = pb[0]!
  const bE = pb[pb.length - 1]!

  const options = [
    { d: dist(aE, bS), revA: false, revB: false },
    { d: dist(aE, bE), revA: false, revB: true },
    { d: dist(aS, bS), revA: true,  revB: false },
    { d: dist(aS, bE), revA: true,  revB: true },
  ]
  const best = options.reduce((p, c) => (c.d < p.d ? c : p))
  if (best.d > maxGap) return null

  const ordA = best.revA ? [...pa].reverse() : [...pa]
  const ordB = best.revB ? [...pb].reverse() : [...pb]

  const from = ordA[ordA.length - 1]!
  const to   = ordB[0]!

  // Insert a single L-shaped bridge if the connection is not axis-aligned
  const bridge: Point[] =
    Math.abs(from.x - to.x) > 1e-9 && Math.abs(from.y - to.y) > 1e-9
      ? [{ x: to.x, y: from.y }]
      : []

  return {
    ...a,
    mspPairId: `merged:${a.mspPairId}+${b.mspPairId}`,
    tracePath: dedupe([...ordA, ...bridge, ...ordB]),
    mspConnectionPairIds: [
      ...a.mspConnectionPairIds,
      ...b.mspConnectionPairIds,
    ],
    pinIds: [...a.pinIds, ...b.pinIds],
  }
}

/**
 * SameNetTraceMergeSolver — pipeline phase that joins trace segments belonging
 * to the same electrical net when their endpoints are within `maxEndpointGap`
 * units of each other.
 *
 * Runs iteratively until no more merges are possible (or the solver is marked
 * solved/failed by the base class iteration guard).
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  readonly inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  readonly maxEndpointGap: number
  /** Total number of merges performed across all _step() calls */
  mergeCount = 0

  constructor({
    traces,
    maxEndpointGap = 0.12,
  }: SameNetTraceMergeSolverParams) {
    super()
    this.inputTraces = [...traces]
    this.outputTraces = [...traces]
    this.maxEndpointGap = maxEndpointGap
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: this.outputTraces }
  }

  override _step(): void {
    // Group current traces by net
    const byNet = new Map<string, SolvedTracePath[]>()
    for (const trace of this.outputTraces) {
      const k = netKey(trace)
      const group = byNet.get(k)
      if (group) group.push(trace)
      else byNet.set(k, [trace])
    }

    let merged = false

    for (const group of byNet.values()) {
      if (group.length < 2) continue

      // O(n²) scan – groups are typically small
      outer: for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const joined = tryMerge(group[i]!, group[j]!, this.maxEndpointGap)
          if (joined) {
            // Replace the two original traces with the merged one
            this.outputTraces = this.outputTraces.filter(
              (t) =>
                t.mspPairId !== group[i]!.mspPairId &&
                t.mspPairId !== group[j]!.mspPairId,
            )
            this.outputTraces.push(joined)
            this.mergeCount++
            merged = true
            break outer // Restart the scan for this net
          }
        }
      }
    }

    if (!merged) {
      // No more mergeable pairs – we're done
      this.solved = true
    }
  }
}
