import { test, expect } from "bun:test"
import { SameNetSegmentMergingSolver } from "lib/solvers/SameNetSegmentMergingSolver/SameNetSegmentMergingSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const emptyInputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

function makeTrace(
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    pins: [
      { pinId: `${id}-a`, chipId: "A", x: path[0]!.x, y: path[0]!.y },
      {
        pinId: `${id}-b`,
        chipId: "B",
        x: path[path.length - 1]!.x,
        y: path[path.length - 1]!.y,
      },
    ],
    tracePath: path,
    mspConnectionPairIds: [id],
    pinIds: [`${id}-a`, `${id}-b`],
  }
}

test("snaps two close parallel same-net interior segments to a common y coordinate", () => {
  // Two Z-shaped traces on the same net whose horizontal middle segments are 0.12 apart
  const solver = new SameNetSegmentMergingSolver({
    inputProblem: emptyInputProblem,
    allTraces: [
      makeTrace("t1", "net1", [
        { x: -3, y: 0 },
        { x: -2, y: 0 },
        { x: -2, y: 1.0 },
        { x: 2, y: 1.0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ]),
      makeTrace("t2", "net1", [
        { x: -3, y: 0 },
        { x: -1, y: 0 },
        { x: -1, y: 1.12 },
        { x: 1, y: 1.12 },
        { x: 1, y: 0 },
        { x: 3, y: 0 },
      ]),
    ],
  })

  solver.solve()

  const traces = solver.getOutput().traces
  expect(solver.solved).toBe(true)

  // Both horizontal interior segments should have been pulled to the same y
  const y1 = traces[0]!.tracePath.find((p, i, arr) => {
    const prev = arr[i - 1]
    return prev && Math.abs(prev.y - p.y) < 1e-6 && Math.abs(p.y - 1.0) < 0.2
  })
  const y2 = traces[1]!.tracePath.find((p, i, arr) => {
    const prev = arr[i - 1]
    return prev && Math.abs(prev.y - p.y) < 1e-6 && Math.abs(p.y - 1.0) < 0.2
  })
  // Both horizontal segments at the same y (merged)
  expect(y1).toBeDefined()
  expect(y2).toBeDefined()
  expect(Math.abs(y1!.y - y2!.y)).toBeLessThan(1e-5)
})

test("does not merge segments from different nets", () => {
  const solver = new SameNetSegmentMergingSolver({
    inputProblem: emptyInputProblem,
    allTraces: [
      makeTrace("t1", "net1", [
        { x: -2, y: 0 },
        { x: -1, y: 0 },
        { x: -1, y: 1.0 },
        { x: 1, y: 1.0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("t2", "net2", [
        { x: -2, y: 0 },
        { x: -1, y: 0 },
        { x: -1, y: 1.1 },
        { x: 1, y: 1.1 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ],
  })

  solver.solve()

  const traces = solver.getOutput().traces
  // net1 trace horizontal segment stays at 1.0
  const seg1 = traces[0]!.tracePath
  const net1HorizY = seg1.find(
    (p, i) => i > 0 && Math.abs(p.y - seg1[i - 1]!.y) < 1e-6 && p.y > 0.5,
  )
  expect(net1HorizY?.y).toBeCloseTo(1.0, 5)

  // net2 trace horizontal segment stays at 1.1
  const seg2 = traces[1]!.tracePath
  const net2HorizY = seg2.find(
    (p, i) => i > 0 && Math.abs(p.y - seg2[i - 1]!.y) < 1e-6 && p.y > 0.5,
  )
  expect(net2HorizY?.y).toBeCloseTo(1.1, 5)
})

test("does not merge segments farther than gapThreshold", () => {
  const solver = new SameNetSegmentMergingSolver({
    inputProblem: emptyInputProblem,
    gapThreshold: 0.1,
    allTraces: [
      makeTrace("t1", "net1", [
        { x: -2, y: 0 },
        { x: -1, y: 0 },
        { x: -1, y: 1.0 },
        { x: 1, y: 1.0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("t2", "net1", [
        { x: -2, y: 0 },
        { x: -1, y: 0 },
        { x: -1, y: 1.5 }, // far away - gap = 0.5, threshold = 0.1
        { x: 1, y: 1.5 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ],
  })

  solver.solve()

  const traces = solver.getOutput().traces
  // Segments should be unchanged (too far apart)
  const seg1Y = traces[0]!.tracePath[2]!.y
  const seg2Y = traces[1]!.tracePath[2]!.y
  expect(seg1Y).toBeCloseTo(1.0, 5)
  expect(seg2Y).toBeCloseTo(1.5, 5)
})

test("anchor endpoint segments are not moved", () => {
  // t1 has a 2-point horizontal-only path (endpoint segment = anchor)
  const solver = new SameNetSegmentMergingSolver({
    inputProblem: emptyInputProblem,
    allTraces: [
      // 2-point straight line - both points are endpoints, canMove = false
      makeTrace("t1", "net1", [
        { x: -3, y: 1.0 },
        { x: 3, y: 1.0 },
      ]),
      makeTrace("t2", "net1", [
        { x: -3, y: 0 },
        { x: -2, y: 0 },
        { x: -2, y: 1.08 },
        { x: 2, y: 1.08 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ]),
    ],
  })

  solver.solve()

  const traces = solver.getOutput().traces
  // Anchor (t1) stays at y=1.0
  expect(traces[0]!.tracePath[0]!.y).toBeCloseTo(1.0, 5)
  expect(traces[0]!.tracePath[1]!.y).toBeCloseTo(1.0, 5)
  // Movable (t2) interior segment is snapped toward anchor at 1.0
  expect(traces[1]!.tracePath[2]!.y).toBeCloseTo(1.0, 5)
  expect(traces[1]!.tracePath[3]!.y).toBeCloseTo(1.0, 5)
})

test("solver marks itself as solved", () => {
  const solver = new SameNetSegmentMergingSolver({
    inputProblem: emptyInputProblem,
    allTraces: [],
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})
