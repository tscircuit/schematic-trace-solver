import { TraceSegmentMergeSolver } from "lib/solvers/TraceSegmentMergeSolver/TraceSegmentMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export type { SolvedTracePath }

export const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [],
    pinIds: [],
    mspConnectionPairIds: [mspPairId],
    tracePath,
  }) as unknown as SolvedTracePath

export const solve = (traces: SolvedTracePath[]) => {
  const solver = new TraceSegmentMergeSolver({ inputTracePaths: traces })
  solver.solve()
  return solver.getOutput().traces
}

export const solveTracePathsByPairId = (traces: SolvedTracePath[]) =>
  Object.fromEntries(
    solve(traces).map((trace) => [trace.mspPairId, trace.tracePath]),
  )

export const hasHorizontalSegmentAtY = (
  trace: SolvedTracePath,
  y: number,
  fromX: number,
  toX: number,
) =>
  trace.tracePath.some((point, index) => {
    const next = trace.tracePath[index + 1]
    if (!next) return false
    if (Math.abs(point.y - y) > 1e-9 || Math.abs(next.y - y) > 1e-9) {
      return false
    }
    return (
      Math.min(point.x, next.x) <= fromX && Math.max(point.x, next.x) >= toX
    )
  })

export const hasVerticalSegmentAtX = (
  trace: SolvedTracePath,
  x: number,
  fromY: number,
  toY: number,
) =>
  trace.tracePath.some((point, index) => {
    const next = trace.tracePath[index + 1]
    if (!next) return false
    if (Math.abs(point.x - x) > 1e-9 || Math.abs(next.x - x) > 1e-9) {
      return false
    }
    return (
      Math.min(point.y, next.y) <= fromY && Math.max(point.y, next.y) >= toY
    )
  })
