import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../../assets/example15.json"

const EPS = 1e-6
const MAX_GAP = 0.25
const MIN_OVERLAP = 0.05

function countCloseSameNetParallelSegments(traces: any[]): number {
  const byNet = new Map<string, any[]>()
  for (const trace of traces) {
    const netId = trace.globalConnNetId ?? trace.dcConnNetId ?? "?"
    const netTraces = byNet.get(netId)
    if (netTraces) netTraces.push(trace)
    else byNet.set(netId, [trace])
  }

  let count = 0
  for (const netTraces of byNet.values()) {
    const segments: Array<{
      orient: "h" | "v"
      fixed: number
      lo: number
      hi: number
    }> = []

    for (const trace of netTraces) {
      const path = trace.tracePath ?? []
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i]!
        const b = path[i + 1]!
        if (Math.abs(a.y - b.y) < EPS && Math.abs(a.x - b.x) > EPS) {
          segments.push({
            orient: "h",
            fixed: a.y,
            lo: Math.min(a.x, b.x),
            hi: Math.max(a.x, b.x),
          })
        } else if (Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) > EPS) {
          segments.push({
            orient: "v",
            fixed: a.x,
            lo: Math.min(a.y, b.y),
            hi: Math.max(a.y, b.y),
          })
        }
      }
    }

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i]!
        const b = segments[j]!
        if (a.orient !== b.orient) continue
        const gap = Math.abs(a.fixed - b.fixed)
        if (gap <= EPS || gap > MAX_GAP) continue
        const overlap = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo)
        if (overlap >= MIN_OVERLAP) count++
      }
    }
  }

  return count
}

test("pipeline removes close same-net double lines from example15", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const cleanupTraces = solver.traceCleanupSolver!.getOutput().traces
  const mergeSolver = (solver as any).sameNetTraceMergeSolver

  expect(countCloseSameNetParallelSegments(cleanupTraces)).toBeGreaterThan(0)
  expect(mergeSolver).toBeDefined()
  expect(
    countCloseSameNetParallelSegments(mergeSolver.getOutput().traces),
  ).toBe(0)
})
