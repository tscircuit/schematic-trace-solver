import { test, expect } from "bun:test"
import { SameNetTraceCombiningSolver } from "lib/solvers/SameNetTraceCombiningSolver/SameNetTraceCombiningSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const emptyInputProblem = {
  chips: [],
  connections: [],
} as unknown as InputProblem

/**
 * Helper to create a minimal SolvedTracePath for testing.
 */
function makeTrace(
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId,
    dcConnNetId: "dc-" + globalConnNetId,
    globalConnNetId,
    pins: [
      {
        chipId: "chip1",
        pinNumber: 1,
        x: tracePath[0].x,
        y: tracePath[0].y,
        pinId: "pin1",
        label: "P1",
      },
      {
        chipId: "chip2",
        pinNumber: 2,
        x: tracePath[tracePath.length - 1].x,
        y: tracePath[tracePath.length - 1].y,
        pinId: "pin2",
        label: "P2",
      },
    ],
    mspConnectionPairIds: [mspPairId],
    pinIds: ["pin1", "pin2"],
    tracePath,
  } as any
}

test("merges two horizontal same-net segments with a tiny gap", () => {
  const trace1 = makeTrace("pair1", "net1", [
    { x: 0, y: 1 },
    { x: 2, y: 1 },
  ])
  const trace2 = makeTrace("pair2", "net1", [
    { x: 2.1, y: 1 },
    { x: 5, y: 1 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyInputProblem,
    allTraces: [trace1, trace2],
  })

  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.getOutput()
  expect(output.traces.length).toBe(2)

  // trace1 should be extended to cover [0, 5]
  const t1 = output.traces[0]
  const t1xs = t1.tracePath.map((p) => p.x).sort((a, b) => a - b)
  expect(t1xs[0]).toBeCloseTo(0, 2)
  expect(t1xs[t1xs.length - 1]).toBeCloseTo(5, 2)

  // trace2 should be collapsed to a zero-length segment
  const t2 = output.traces[1]
  expect(Math.abs(t2.tracePath[0].x - t2.tracePath[1].x)).toBeLessThan(0.01)
})

test("does NOT merge segments of different nets", () => {
  const trace1 = makeTrace("pair1", "net1", [
    { x: 0, y: 1 },
    { x: 2, y: 1 },
  ])
  const trace2 = makeTrace("pair2", "net2", [
    { x: 2.1, y: 1 },
    { x: 5, y: 1 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyInputProblem,
    allTraces: [trace1, trace2],
  })

  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.getOutput()
  // Both traces should be unchanged
  const t1 = output.traces[0]
  expect(t1.tracePath[0].x).toBeCloseTo(0, 2)
  expect(t1.tracePath[1].x).toBeCloseTo(2, 2)

  const t2 = output.traces[1]
  expect(t2.tracePath[0].x).toBeCloseTo(2.1, 2)
  expect(t2.tracePath[1].x).toBeCloseTo(5, 2)
})

test("does NOT merge same-net segments that are far apart", () => {
  const trace1 = makeTrace("pair1", "net1", [
    { x: 0, y: 1 },
    { x: 2, y: 1 },
  ])
  const trace2 = makeTrace("pair2", "net1", [
    { x: 3, y: 1 },
    { x: 5, y: 1 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyInputProblem,
    allTraces: [trace1, trace2],
  })

  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.getOutput()
  // Gap is 1.0, which exceeds GAP_TOLERANCE (0.15), so no merge
  const t1 = output.traces[0]
  expect(t1.tracePath[0].x).toBeCloseTo(0, 2)
  expect(t1.tracePath[1].x).toBeCloseTo(2, 2)

  const t2 = output.traces[1]
  expect(t2.tracePath[0].x).toBeCloseTo(3, 2)
  expect(t2.tracePath[1].x).toBeCloseTo(5, 2)
})

test("handles empty trace list without crashing", () => {
  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyInputProblem,
    allTraces: [],
  })

  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.getOutput().traces.length).toBe(0)
})

test("merges vertical collinear same-net segments", () => {
  const trace1 = makeTrace("pair1", "net1", [
    { x: 1, y: 0 },
    { x: 1, y: 2 },
  ])
  const trace2 = makeTrace("pair2", "net1", [
    { x: 1, y: 2.05 },
    { x: 1, y: 4 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyInputProblem,
    allTraces: [trace1, trace2],
  })

  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.getOutput()
  // trace1 should be extended to cover [0, 4] vertically
  const t1 = output.traces[0]
  const t1ys = t1.tracePath.map((p) => p.y).sort((a, b) => a - b)
  expect(t1ys[0]).toBeCloseTo(0, 2)
  expect(t1ys[t1ys.length - 1]).toBeCloseTo(4, 2)

  // trace2 should be collapsed
  const t2 = output.traces[1]
  expect(Math.abs(t2.tracePath[0].y - t2.tracePath[1].y)).toBeLessThan(0.01)
})

test("does NOT merge segments on different axis lines (non-collinear)", () => {
  const trace1 = makeTrace("pair1", "net1", [
    { x: 0, y: 1 },
    { x: 2, y: 1 },
  ])
  const trace2 = makeTrace("pair2", "net1", [
    { x: 2.1, y: 2 },
    { x: 5, y: 2 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyInputProblem,
    allTraces: [trace1, trace2],
  })

  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.getOutput()
  // Y coordinates differ by 1.0, exceeding COLLINEAR_TOLERANCE
  const t1 = output.traces[0]
  expect(t1.tracePath[0].x).toBeCloseTo(0, 2)
  expect(t1.tracePath[1].x).toBeCloseTo(2, 2)

  const t2 = output.traces[1]
  expect(t2.tracePath[0].x).toBeCloseTo(2.1, 2)
  expect(t2.tracePath[1].x).toBeCloseTo(5, 2)
})

test("merges overlapping same-net segments", () => {
  const trace1 = makeTrace("pair1", "net1", [
    { x: 0, y: 1 },
    { x: 3, y: 1 },
  ])
  const trace2 = makeTrace("pair2", "net1", [
    { x: 2, y: 1 },
    { x: 5, y: 1 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyInputProblem,
    allTraces: [trace1, trace2],
  })

  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.getOutput()
  // trace1 should span [0, 5]
  const t1 = output.traces[0]
  const t1xs = t1.tracePath.map((p) => p.x).sort((a, b) => a - b)
  expect(t1xs[0]).toBeCloseTo(0, 2)
  expect(t1xs[t1xs.length - 1]).toBeCloseTo(5, 2)
})

test("handles single trace per net (no merge needed)", () => {
  const trace1 = makeTrace("pair1", "net1", [
    { x: 0, y: 1 },
    { x: 2, y: 1 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyInputProblem,
    allTraces: [trace1],
  })

  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.getOutput()
  expect(output.traces[0].tracePath[0].x).toBeCloseTo(0, 2)
  expect(output.traces[0].tracePath[1].x).toBeCloseTo(2, 2)
})
