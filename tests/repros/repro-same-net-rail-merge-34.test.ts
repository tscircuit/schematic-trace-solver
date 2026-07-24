import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example45.json"

// https://github.com/tscircuit/schematic-trace-solver/issues/34
// Same-net trace lines that are close together should be merged onto the
// same X (or Y). In example45 the generated SDA net-label connector trace
// ran a vertical rail at x=10.42 while the R10.2->CONN1.3 trace ran a
// parallel rail 0.166 apart at x=10.58 — the classic "two rails that should
// be one" symptom. Generated net-label connector traces are now eligible
// for the same-net rail alignment cleanup pass, which merges them.
test("close parallel same-net rails are merged onto the same coordinate", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces

  // Collect axis-aligned segments per net
  const segsByNet: Record<
    string,
    Array<{ o: "h" | "v"; c: number; lo: number; hi: number }>
  > = {}
  for (const trace of traces) {
    const net = trace.globalConnNetId
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const a = trace.tracePath[i]!
      const b = trace.tracePath[i + 1]!
      if (Math.abs(a.y - b.y) < 1e-9 && Math.abs(a.x - b.x) > 0.2) {
        ;(segsByNet[net] ??= []).push({
          o: "h",
          c: a.y,
          lo: Math.min(a.x, b.x),
          hi: Math.max(a.x, b.x),
        })
      } else if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) > 0.2) {
        ;(segsByNet[net] ??= []).push({
          o: "v",
          c: a.x,
          lo: Math.min(a.y, b.y),
          hi: Math.max(a.y, b.y),
        })
      }
    }
  }

  // No two same-net parallel segments should overlap along their length
  // while sitting within 0.3 of each other on different coordinates
  const unmergedRails: string[] = []
  for (const [net, segs] of Object.entries(segsByNet)) {
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const A = segs[i]!
        const B = segs[j]!
        if (A.o !== B.o) continue
        const gap = Math.abs(A.c - B.c)
        if (gap < 1e-9 || gap > 0.3) continue
        const overlap = Math.min(A.hi, B.hi) - Math.max(A.lo, B.lo)
        if (overlap > 0.3) {
          unmergedRails.push(
            `net ${net}: two ${A.o}-rails ${gap.toFixed(3)} apart with ${overlap.toFixed(2)} overlap`,
          )
        }
      }
    }
  }

  expect(unmergedRails).toEqual([])
})
