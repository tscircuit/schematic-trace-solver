import { expect, test } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const emptyInputProblem: InputProblem = {
  chips: [],
  connections: [],
  netLabels: [],
  bounds: { minX: -10, minY: -10, maxX: 10, maxY: 10 },
}

test("merges close parallel horizontal segments on the same net", () => {
  const traceA: SolvedTracePath = {
    mspPairId: "pair1",
    dcConnNetId: "net1",
    globalConnNetId: "net1",
    pins: [] as any,
    tracePath: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ],
    mspConnectionPairIds: ["pair1"],
    pinIds: [],
  }

  const traceB: SolvedTracePath = {
    mspPairId: "pair2",
    dcConnNetId: "net1",
    globalConnNetId: "net1",
    pins: [] as any,
    tracePath: [
      { x: 1, y: 0.1 },
      { x: 4, y: 0.1 },
    ],
    mspConnectionPairIds: ["pair2"],
    pinIds: [],
  }

  const solver = new SameNetTraceMergeSolver({
    inputProblem: emptyInputProblem,
    allTraces: [traceA, traceB],
  })

  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.getOutput()
  // traceB's y coordinates should have been shifted to match traceA's y=0
  const mergedTrace = output.traces.find((t) => t.mspPairId === "pair2")!
  for (const point of mergedTrace.tracePath) {
    expect(point.y).toBe(0)
  }
})

test("merges close parallel vertical segments on the same net", () => {
  const traceA: SolvedTracePath = {
    mspPairId: "pair1",
    dcConnNetId: "net1",
    globalConnNetId: "net1",
    pins: [] as any,
    tracePath: [
      { x: 0, y: 0 },
      { x: 0, y: 5 },
    ],
    mspConnectionPairIds: ["pair1"],
    pinIds: [],
  }

  const traceB: SolvedTracePath = {
    mspPairId: "pair2",
    dcConnNetId: "net1",
    globalConnNetId: "net1",
    pins: [] as any,
    tracePath: [
      { x: 0.1, y: 1 },
      { x: 0.1, y: 4 },
    ],
    mspConnectionPairIds: ["pair2"],
    pinIds: [],
  }

  const solver = new SameNetTraceMergeSolver({
    inputProblem: emptyInputProblem,
    allTraces: [traceA, traceB],
  })

  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.getOutput()
  const mergedTrace = output.traces.find((t) => t.mspPairId === "pair2")!
  for (const point of mergedTrace.tracePath) {
    expect(point.x).toBe(0)
  }
})

test("does not merge segments on different nets", () => {
  const traceA: SolvedTracePath = {
    mspPairId: "pair1",
    dcConnNetId: "net1",
    globalConnNetId: "net1",
    pins: [] as any,
    tracePath: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ],
    mspConnectionPairIds: ["pair1"],
    pinIds: [],
  }

  const traceB: SolvedTracePath = {
    mspPairId: "pair2",
    dcConnNetId: "net2",
    globalConnNetId: "net2",
    pins: [] as any,
    tracePath: [
      { x: 1, y: 0.1 },
      { x: 4, y: 0.1 },
    ],
    mspConnectionPairIds: ["pair2"],
    pinIds: [],
  }

  const solver = new SameNetTraceMergeSolver({
    inputProblem: emptyInputProblem,
    allTraces: [traceA, traceB],
  })

  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.getOutput()
  const trace = output.traces.find((t) => t.mspPairId === "pair2")!
  // Should NOT be merged - y should stay at 0.1
  expect(trace.tracePath[0]!.y).toBe(0.1)
})

test("does not merge segments that are too far apart", () => {
  const traceA: SolvedTracePath = {
    mspPairId: "pair1",
    dcConnNetId: "net1",
    globalConnNetId: "net1",
    pins: [] as any,
    tracePath: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ],
    mspConnectionPairIds: ["pair1"],
    pinIds: [],
  }

  const traceB: SolvedTracePath = {
    mspPairId: "pair2",
    dcConnNetId: "net1",
    globalConnNetId: "net1",
    pins: [] as any,
    tracePath: [
      { x: 1, y: 0.5 },
      { x: 4, y: 0.5 },
    ],
    mspConnectionPairIds: ["pair2"],
    pinIds: [],
  }

  const solver = new SameNetTraceMergeSolver({
    inputProblem: emptyInputProblem,
    allTraces: [traceA, traceB],
  })

  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.getOutput()
  const trace = output.traces.find((t) => t.mspPairId === "pair2")!
  // Should NOT be merged - y should stay at 0.5
  expect(trace.tracePath[0]!.y).toBe(0.5)
})
