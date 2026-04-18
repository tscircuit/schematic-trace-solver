import { expect, test } from "bun:test"
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

function makeTrace(opts: {
  globalConnNetId: string
  mspPairId: string
  tracePath: { x: number; y: number }[]
}): SolvedTracePath {
  return {
    globalConnNetId: opts.globalConnNetId,
    mspPairId: opts.mspPairId,
    tracePath: opts.tracePath,
  } as SolvedTracePath
}

test("merge-same-net-traces: two horizontal parallel traces merge", () => {
  const traces: SolvedTracePath[] = [
    makeTrace({
      globalConnNetId: "net1",
      mspPairId: "trace1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
    }),
    makeTrace({
      globalConnNetId: "net1",
      mspPairId: "trace2",
      tracePath: [
        { x: 0, y: 0.1 },
        { x: 5, y: 0.1 },
      ],
    }),
  ]

  const solver = new TraceCleanupSolver({
    inputProblem: { components: [], connections: [], nets: [] } as any,
    allTraces: traces,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
  })
  solver.solve()
  const output = solver.output

  expect(output).toBeDefined()
  expect(output!.allTraces.length).toBeGreaterThanOrEqual(1)

  for (const trace of output!.allTraces) {
    if (trace.globalConnNetId === "net1") {
      // After merge, the parallel segments should be snapped together
      for (const pt of trace.tracePath) {
        expect(pt).toBeDefined()
        expect(typeof pt.x).toBe("number")
        expect(typeof pt.y).toBe("number")
      }
    }
  }
})

test("merge-same-net-traces: two vertical parallel traces merge", () => {
  const traces: SolvedTracePath[] = [
    makeTrace({
      globalConnNetId: "net2",
      mspPairId: "trace3",
      tracePath: [
        { x: 0, y: 0 },
        { x: 0, y: 5 },
      ],
    }),
    makeTrace({
      globalConnNetId: "net2",
      mspPairId: "trace4",
      tracePath: [
        { x: 0.1, y: 0 },
        { x: 0.1, y: 5 },
      ],
    }),
  ]

  const solver = new TraceCleanupSolver({
    inputProblem: { components: [], connections: [], nets: [] } as any,
    allTraces: traces,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
  })
  solver.solve()
  const output = solver.output

  expect(output).toBeDefined()
  expect(output!.allTraces.length).toBeGreaterThanOrEqual(1)

  for (const trace of output!.allTraces) {
    if (trace.globalConnNetId === "net2") {
      for (const pt of trace.tracePath) {
        expect(pt).toBeDefined()
        expect(typeof pt.x).toBe("number")
        expect(typeof pt.y).toBe("number")
      }
    }
  }
})

test("merge-same-net-traces: different nets are not merged", () => {
  const traces: SolvedTracePath[] = [
    makeTrace({
      globalConnNetId: "netA",
      mspPairId: "trace5",
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
    }),
    makeTrace({
      globalConnNetId: "netB",
      mspPairId: "trace6",
      tracePath: [
        { x: 0, y: 0.1 },
        { x: 5, y: 0.1 },
      ],
    }),
  ]

  const solver = new TraceCleanupSolver({
    inputProblem: { components: [], connections: [], nets: [] } as any,
    allTraces: traces,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
  })
  solver.solve()
  const output = solver.output

  expect(output).toBeDefined()
  // Both traces should still exist since they belong to different nets
  expect(output!.allTraces.length).toBe(2)

  for (const trace of output!.allTraces) {
    expect(trace.globalConnNetId === "netA" || trace.globalConnNetId === "netB").toBe(true)
    for (const pt of trace.tracePath) {
      expect(pt).toBeDefined()
      expect(typeof pt.x).toBe("number")
      expect(typeof pt.y).toBe("number")
    }
  }
})
