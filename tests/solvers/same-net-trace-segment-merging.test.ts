import { expect, test } from "bun:test"
import { SameNetTraceSegmentMergingSolver } from "lib/solvers/SameNetTraceSegmentMergingSolver/SameNetTraceSegmentMergingSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const emptyInputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

function makeTrace(
  overrides: Partial<SolvedTracePath> & {
    tracePath: { x: number; y: number }[]
    globalConnNetId: string
    mspPairId: string
  },
): SolvedTracePath {
  return {
    dcConnNetId: overrides.dcConnNetId ?? overrides.globalConnNetId,
    globalConnNetId: overrides.globalConnNetId,
    mspPairId: overrides.mspPairId,
    pins:
      overrides.pins ??
      ([
        { pinId: "p1", x: 0, y: 0, chipId: "c1" },
        { pinId: "p2", x: 1, y: 0, chipId: "c2" },
      ] as SolvedTracePath["pins"]),
    tracePath: overrides.tracePath,
    mspConnectionPairIds: overrides.mspConnectionPairIds ?? [
      overrides.mspPairId,
    ],
    pinIds: overrides.pinIds ?? ["p1", "p2"],
  }
}

test("merges two horizontal same-net segments with a tiny gap", () => {
  const traceA = makeTrace({
    mspPairId: "pair1",
    globalConnNetId: "net1",
    tracePath: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 2, y: 1 }, // horizontal segment from x=0 to x=2 at y=1
      { x: 2, y: 2 },
    ],
  })

  const traceB = makeTrace({
    mspPairId: "pair2",
    globalConnNetId: "net1",
    tracePath: [
      { x: 5, y: 3 },
      { x: 5, y: 1 },
      { x: 2.1, y: 1 }, // horizontal segment from x=5 to x=2.1 at y=1 (gap = 0.1)
      { x: 2.1, y: 0 },
    ],
  })

  const solver = new SameNetTraceSegmentMergingSolver({
    allTraces: [traceA, traceB],
    inputProblem: emptyInputProblem,
  })

  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.getOutput()
  expect(output.traces).toHaveLength(2)

  // The merged segment should span from x=0 to x=5
  const mergedTraceA = output.traces[0]
  const horizontalSegA = mergedTraceA.tracePath.slice(1, 3)
  const xValues = horizontalSegA.map((p) => p.x)
  expect(Math.min(...xValues)).toBe(0)
  expect(Math.max(...xValues)).toBe(5)
})

test("does NOT merge segments of different nets", () => {
  const traceA = makeTrace({
    mspPairId: "pair1",
    globalConnNetId: "net1",
    tracePath: [
      { x: 0, y: 0 },
      { x: 2, y: 0 }, // horizontal at y=0
    ],
  })

  const traceB = makeTrace({
    mspPairId: "pair2",
    globalConnNetId: "net2", // different net
    tracePath: [
      { x: 2.1, y: 0 },
      { x: 4, y: 0 }, // horizontal at y=0, gap=0.1
    ],
  })

  const solver = new SameNetTraceSegmentMergingSolver({
    allTraces: [traceA, traceB],
    inputProblem: emptyInputProblem,
  })

  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.getOutput()
  // Segments should remain unchanged
  expect(output.traces[0].tracePath[0].x).toBe(0)
  expect(output.traces[0].tracePath[1].x).toBe(2)
  expect(output.traces[1].tracePath[0].x).toBe(2.1)
  expect(output.traces[1].tracePath[1].x).toBe(4)
})

test("does NOT merge same-net segments that are far apart", () => {
  const traceA = makeTrace({
    mspPairId: "pair1",
    globalConnNetId: "net1",
    tracePath: [
      { x: 0, y: 0 },
      { x: 2, y: 0 }, // horizontal at y=0
    ],
  })

  const traceB = makeTrace({
    mspPairId: "pair2",
    globalConnNetId: "net1",
    tracePath: [
      { x: 3, y: 0 },
      { x: 5, y: 0 }, // horizontal at y=0, but gap=1.0
    ],
  })

  const solver = new SameNetTraceSegmentMergingSolver({
    allTraces: [traceA, traceB],
    inputProblem: emptyInputProblem,
  })

  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.getOutput()
  // Segments should remain unchanged
  expect(output.traces[0].tracePath[0].x).toBe(0)
  expect(output.traces[0].tracePath[1].x).toBe(2)
  expect(output.traces[1].tracePath[0].x).toBe(3)
  expect(output.traces[1].tracePath[1].x).toBe(5)
})

test("handles empty trace list without crashing", () => {
  const solver = new SameNetTraceSegmentMergingSolver({
    allTraces: [],
    inputProblem: emptyInputProblem,
  })

  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.getOutput().traces).toHaveLength(0)
})

test("merges vertical collinear same-net segments", () => {
  const traceA = makeTrace({
    mspPairId: "pair1",
    globalConnNetId: "net1",
    tracePath: [
      { x: 1, y: 0 },
      { x: 1, y: 2 }, // vertical at x=1
    ],
  })

  const traceB = makeTrace({
    mspPairId: "pair2",
    globalConnNetId: "net1",
    tracePath: [
      { x: 1, y: 2.1 },
      { x: 1, y: 4 }, // vertical at x=1, gap=0.1
    ],
  })

  const solver = new SameNetTraceSegmentMergingSolver({
    allTraces: [traceA, traceB],
    inputProblem: emptyInputProblem,
  })

  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.getOutput()
  // The merged segment A should span from y=0 to y=4
  const yValues = output.traces[0].tracePath.map((p) => p.y)
  expect(Math.min(...yValues)).toBe(0)
  expect(Math.max(...yValues)).toBe(4)
})
