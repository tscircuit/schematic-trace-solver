import { expect, test } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const minimalInputProblem: InputProblem = {
  chips: [],
  connections: [],
}

function makeTrace(
  overrides: Partial<SolvedTracePath> & { tracePath: { x: number; y: number }[] },
): SolvedTracePath {
  return {
    mspPairId: "pair1",
    dcConnNetId: "dc1",
    globalConnNetId: "net1",
    pins: [] as any,
    mspConnectionPairIds: ["pair1"],
    pinIds: ["p1", "p2"],
    ...overrides,
  }
}

test("merges close parallel horizontal segments on the same net", () => {
  const traces: SolvedTracePath[] = [
    makeTrace({
      mspPairId: "pair1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
      ],
    }),
    makeTrace({
      mspPairId: "pair2",
      tracePath: [
        { x: 0, y: 0.1 },
        { x: 2, y: 0.1 },
        { x: 2, y: 2 },
      ],
    }),
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem: minimalInputProblem,
    allTraces: traces,
  })

  solver.solve()
  const output = solver.getOutput()

  // The second trace's horizontal segment (y=0.1) should be merged to y=0
  const trace2 = output.traces.find((t) => t.mspPairId === "pair2")!
  expect(trace2.tracePath[0].y).toBe(0)
  expect(trace2.tracePath[1].y).toBe(0)
})

test("does not merge segments from different nets", () => {
  const traces: SolvedTracePath[] = [
    makeTrace({
      mspPairId: "pair1",
      globalConnNetId: "net1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
    }),
    makeTrace({
      mspPairId: "pair2",
      globalConnNetId: "net2",
      tracePath: [
        { x: 0, y: 0.1 },
        { x: 2, y: 0.1 },
      ],
    }),
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem: minimalInputProblem,
    allTraces: traces,
  })

  solver.solve()
  const output = solver.getOutput()

  // Segments should remain at their original y positions
  const trace2 = output.traces.find((t) => t.mspPairId === "pair2")!
  expect(trace2.tracePath[0].y).toBeCloseTo(0.1)
})

test("does not merge segments that are far apart", () => {
  const traces: SolvedTracePath[] = [
    makeTrace({
      mspPairId: "pair1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
    }),
    makeTrace({
      mspPairId: "pair2",
      tracePath: [
        { x: 0, y: 1 },
        { x: 2, y: 1 },
      ],
    }),
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem: minimalInputProblem,
    allTraces: traces,
  })

  solver.solve()
  const output = solver.getOutput()

  const trace2 = output.traces.find((t) => t.mspPairId === "pair2")!
  expect(trace2.tracePath[0].y).toBe(1)
})

test("merges close vertical segments on the same net", () => {
  const traces: SolvedTracePath[] = [
    makeTrace({
      mspPairId: "pair1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 0, y: 2 },
      ],
    }),
    makeTrace({
      mspPairId: "pair2",
      tracePath: [
        { x: 0.1, y: 0 },
        { x: 0.1, y: 2 },
      ],
    }),
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem: minimalInputProblem,
    allTraces: traces,
  })

  solver.solve()
  const output = solver.getOutput()

  const trace2 = output.traces.find((t) => t.mspPairId === "pair2")!
  expect(trace2.tracePath[0].x).toBe(0)
  expect(trace2.tracePath[1].x).toBe(0)
})

test("removes collinear redundant points after merge", () => {
  const traces: SolvedTracePath[] = [
    makeTrace({
      mspPairId: "pair1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ],
    }),
    makeTrace({
      mspPairId: "pair2",
      tracePath: [
        { x: 0, y: 0.05 },
        { x: 1, y: 0.05 },
        { x: 1, y: 0.05 },
        { x: 3, y: 0.05 },
      ],
    }),
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem: minimalInputProblem,
    allTraces: traces,
  })

  solver.solve()
  const output = solver.getOutput()

  const trace2 = output.traces.find((t) => t.mspPairId === "pair2")!
  // After merge all points should be at y=0, and collinear/duplicate points removed
  expect(trace2.tracePath.length).toBeLessThanOrEqual(2)
  for (const p of trace2.tracePath) {
    expect(p.y).toBe(0)
  }
})
