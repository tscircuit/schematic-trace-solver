import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "../assets/example45.json"

// Reproduction for https://github.com/tscircuit/schematic-trace-solver/issues/34
//
// Same-net trace lines that are close together should be merged onto the same
// X (or Y). The rail-alignment cleanup added in #663 handles most cases, but
// generated net-label connector traces are excluded from the eligible set
// (traceCleanupSolver2 derives eligibleTraceIds from the *first* cleanup
// pass, which runs before AvailableNetOrientationSolver creates connectors).
//
// On example45 the generated SDA connector runs a vertical rail at x=10.42
// while the same-net R10.2->CONN1.3 trace runs a parallel rail 0.166 away at
// x=10.58 with 0.5 of overlapping length — two rails that should be one line:
//
//   R10.2-CONN1.3:                  (10.15,0.70)->(10.58,0.70)->(10.58,0.10)->(11.02,0.10)
//   available-net-orientation-1-SDA: (10.37,0.70)->(10.42,0.70)->(10.42,0.20)->(10.32,0.20)
//
// This test pins the CURRENT (buggy) behavior so the bug is tracked by CI.
// A fix should flip the assertion to .toEqual([]).
test("repro #34: generated connector rail runs parallel to same-net trace rail", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces

  const segsByNet: Record<
    string,
    Array<{ o: "h" | "v"; c: number; lo: number; hi: number; id: string }>
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
          id: trace.mspPairId,
        })
      } else if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) > 0.2) {
        ;(segsByNet[net] ??= []).push({
          o: "v",
          c: a.x,
          lo: Math.min(a.y, b.y),
          hi: Math.max(a.y, b.y),
          id: trace.mspPairId,
        })
      }
    }
  }

  const unmergedRails: string[] = []
  for (const segs of Object.values(segsByNet)) {
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const a = segs[i]!
        const b = segs[j]!
        if (a.o !== b.o) continue
        const gap = Math.abs(a.c - b.c)
        if (gap < 1e-9 || gap > 0.3) continue
        const overlap = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo)
        if (overlap > 0.3) {
          unmergedRails.push([a.id, b.id].sort().join(" | "))
        }
      }
    }
  }

  // BUG: the SDA connector rail and the R10.2-CONN1.3 rail stay 0.166 apart
  expect(unmergedRails.sort()).toEqual([
    "R10.2-CONN1.3 | available-net-orientation-1-SDA",
  ])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
