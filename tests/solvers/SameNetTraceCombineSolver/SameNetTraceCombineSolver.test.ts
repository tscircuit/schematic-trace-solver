import { test, expect } from "bun:test"
import { SameNetTraceCombineSolver } from "lib/solvers/SameNetTraceCombineSolver/SameNetTraceCombineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const emptyInputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [
      { pinId: `${mspPairId}.a`, x: 0, y: 0, chipId: "c" },
      { pinId: `${mspPairId}.b`, x: 0, y: 0, chipId: "c" },
    ],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}.a`, `${mspPairId}.b`],
  }) as unknown as SolvedTracePath

test("combines two close parallel horizontal segments on the same net", () => {
  // Two traces on the same net "N1". Each has a horizontal middle segment that
  // runs at a slightly different y but spans the same x-range.
  //   trace A: (0,0) -> (1,0) -> (1,1.0) -> (2,1.0) -> (2,2) -> (3,2)
  //   trace B: (0,3) -> (1,3) -> (1,1.1) -> (2,1.1) -> (2,4) -> (3,4)
  // Expected: the middle segments are snapped to a shared y (≈1.05).
  const traces: SolvedTracePath[] = [
    makeTrace("A", "N1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1.0 },
      { x: 2, y: 1.0 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ]),
    makeTrace("B", "N1", [
      { x: 0, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 1.1 },
      { x: 2, y: 1.1 },
      { x: 2, y: 4 },
      { x: 3, y: 4 },
    ]),
  ]

  const solver = new SameNetTraceCombineSolver({
    inputProblem: emptyInputProblem,
    inputTracePaths: traces,
  })
  solver.solve()

  const out = solver.getOutput().traces
  const a = out.find((t) => t.mspPairId === "A")!
  const b = out.find((t) => t.mspPairId === "B")!

  // Locate the middle horizontal segment of each trace.
  const horzMid = (t: SolvedTracePath) => {
    const path = t.tracePath
    for (let i = 1; i < path.length - 2; i++) {
      const p1 = path[i]!
      const p2 = path[i + 1]!
      if (Math.abs(p1.y - p2.y) < 1e-6 && Math.abs(p1.x - p2.x) > 1e-6) {
        return p1.y
      }
    }
    return null
  }

  const yA = horzMid(a)
  const yB = horzMid(b)
  expect(yA).not.toBeNull()
  expect(yB).not.toBeNull()
  expect(Math.abs(yA! - yB!)).toBeLessThan(1e-6)

  // Pin endpoints are preserved.
  expect(a.tracePath[0]).toEqual({ x: 0, y: 0 })
  expect(a.tracePath[a.tracePath.length - 1]).toEqual({ x: 3, y: 2 })
  expect(b.tracePath[0]).toEqual({ x: 0, y: 3 })
  expect(b.tracePath[b.tracePath.length - 1]).toEqual({ x: 3, y: 4 })
})

test("does not combine segments that are too far apart", () => {
  const traces: SolvedTracePath[] = [
    makeTrace("A", "N1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1.0 },
      { x: 2, y: 1.0 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ]),
    makeTrace("B", "N1", [
      { x: 0, y: 5 },
      { x: 1, y: 5 },
      { x: 1, y: 4.0 },
      { x: 2, y: 4.0 },
      { x: 2, y: 6 },
      { x: 3, y: 6 },
    ]),
  ]
  const solver = new SameNetTraceCombineSolver({
    inputProblem: emptyInputProblem,
    inputTracePaths: traces,
    closeDistanceThreshold: 0.2,
  })
  solver.solve()

  const out = solver.getOutput().traces
  // Inputs were cloned; outputs should retain their distinct y values.
  expect(out[0]!.tracePath[2]!.y).toBe(1.0)
  expect(out[1]!.tracePath[2]!.y).toBe(4.0)
})

test("does not combine segments on different nets", () => {
  const traces: SolvedTracePath[] = [
    makeTrace("A", "N1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1.0 },
      { x: 2, y: 1.0 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ]),
    makeTrace("B", "N2", [
      { x: 0, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 1.1 },
      { x: 2, y: 1.1 },
      { x: 2, y: 4 },
      { x: 3, y: 4 },
    ]),
  ]
  const solver = new SameNetTraceCombineSolver({
    inputProblem: emptyInputProblem,
    inputTracePaths: traces,
  })
  solver.solve()
  const out = solver.getOutput().traces
  // Different nets should not be merged.
  expect(out[0]!.tracePath[2]!.y).toBe(1.0)
  expect(out[1]!.tracePath[2]!.y).toBe(1.1)
})
