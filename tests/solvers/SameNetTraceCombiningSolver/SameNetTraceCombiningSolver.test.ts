import { expect, test } from "bun:test"
import {
  SameNetTraceCombiningSolver,
  simplifyTracePath,
} from "lib/solvers/SameNetTraceCombiningSolver/SameNetTraceCombiningSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createInputProblem = (): InputProblem => ({
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
})

function makeTrace(
  mspPairId: string,
  globalConnNetId: string,
  path: { x: number; y: number }[],
): SolvedTracePath {
  return {
    mspPairId,
    globalConnNetId,
    dcConnNetId: globalConnNetId,
    tracePath: [...path.map((p) => ({ ...p }))],
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [
      { pinId: "p1", x: path[0].x, y: path[0].y, chipId: "c1" },
      {
        pinId: "p2",
        x: path[path.length - 1].x,
        y: path[path.length - 1].y,
        chipId: "c2",
      },
    ],
  }
}

test("SameNetTraceCombiningSolver merges close horizontal collinear segments on same net", () => {
  // Two traces on the same net, each with a horizontal segment at nearly the same Y.
  // Trace A: (0, 0) -> (2, 0) -> (2, 1)
  // Trace B: (1, 0.03) -> (3, 0.03) -> (3, 1)
  // The horizontal segments at Y≈0 should be merged.
  const traces: SolvedTracePath[] = [
    makeTrace("traceA", "net1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ]),
    makeTrace("traceB", "net1", [
      { x: 1, y: 0.03 },
      { x: 3, y: 0.03 },
      { x: 3, y: 1 },
    ]),
  ]

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: createInputProblem(),
    allTraces: traces,
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces).toHaveLength(2)

  // Trace A's horizontal segment should now span from x=0 to x=3 at Y≈0.015
  const traceAPath = output.traces[0].tracePath
  expect(traceAPath.length).toBe(3)
  expect(traceAPath[0].x).toBe(0)
  expect(traceAPath[1].x).toBe(3) // Extended to cover both spans
  expect(traceAPath[0].y).toBeCloseTo(0.015, 2)
  expect(traceAPath[1].y).toBeCloseTo(0.015, 2)

  // Trace B's horizontal segment should be collapsed (its start and end become same point)
  // After simplification, it should be reduced to 2 points
  const traceBPath = output.traces[1].tracePath
  // The horizontal segment was collapsed -> simplified away, leaving 2 points
  expect(traceBPath.length).toBe(2)
})

test("SameNetTraceCombiningSolver merges close vertical collinear segments on same net", () => {
  // Two traces on the same net with vertical segments at nearly the same X.
  const traces: SolvedTracePath[] = [
    makeTrace("traceA", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ]),
    makeTrace("traceB", "net1", [
      { x: 0.04, y: 1 },
      { x: 0.04, y: 3 },
      { x: 1, y: 3 },
    ]),
  ]

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: createInputProblem(),
    allTraces: traces,
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces).toHaveLength(2)

  // Trace A's vertical segment should be extended
  const traceAPath = output.traces[0].tracePath
  expect(traceAPath.length).toBe(3)
  expect(traceAPath[0].x).toBeCloseTo(0.02, 2)
  expect(traceAPath[1].x).toBeCloseTo(0.02, 2)
  expect(traceAPath[0].y).toBe(0)
  expect(traceAPath[1].y).toBe(3) // Extended

  // Trace B's vertical segment collapsed
  const traceBPath = output.traces[1].tracePath
  expect(traceBPath.length).toBe(2)
})

test("SameNetTraceCombiningSolver does NOT merge segments on different nets", () => {
  const traces: SolvedTracePath[] = [
    makeTrace("traceA", "net1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("traceB", "net2", [
      { x: 1, y: 0.03 },
      { x: 3, y: 0.03 },
    ]),
  ]

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: createInputProblem(),
    allTraces: traces,
  })
  solver.solve()

  const output = solver.getOutput()
  // No merging should happen because segments belong to different nets
  const traceAPath = output.traces[0].tracePath
  expect(traceAPath[1].x).toBe(2) // unchanged
  const traceBPath = output.traces[1].tracePath
  expect(traceBPath[1].x).toBe(3) // unchanged
})

test("SameNetTraceCombiningSolver does NOT merge segments with large gap", () => {
  // Segments gapped by 1.0 should not be merged (gap > GAP_TOLERANCE 0.15)
  const traces: SolvedTracePath[] = [
    makeTrace("traceA", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("traceB", "net1", [
      { x: 2.5, y: 0.03 },
      { x: 3.5, y: 0.03 },
    ]),
  ]

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: createInputProblem(),
    allTraces: traces,
  })
  solver.solve()

  const output = solver.getOutput()
  // No merging should happen — gap is ~1.5 > 0.15
  const traceAPath = output.traces[0].tracePath
  expect(traceAPath[1].x).toBe(1) // unchanged
  const traceBPath = output.traces[1].tracePath
  expect(traceBPath[1].x).toBe(3.5) // unchanged
})

test("SameNetTraceCombiningSolver handles overlapping segments", () => {
  // Two overlapping horizontal segments on same net
  const traces: SolvedTracePath[] = [
    makeTrace("traceA", "net1", [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ]),
    makeTrace("traceB", "net1", [
      { x: 2, y: 0.01 },
      { x: 5, y: 0.01 },
    ]),
  ]

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: createInputProblem(),
    allTraces: traces,
  })
  solver.solve()

  const output = solver.getOutput()
  const traceAPath = output.traces[0].tracePath
  expect(traceAPath[1].x).toBe(5) // Extended to cover B's span
  const traceBPath = output.traces[1].tracePath
  expect(traceBPath.length).toBe(1)
})

test("simplifyTracePath removes consecutive duplicate points", () => {
  const result = simplifyTracePath([
    { x: 0, y: 0 },
    { x: 0, y: 0 }, // duplicate
    { x: 1, y: 0 },
    { x: 1, y: 0 }, // duplicate
    { x: 1, y: 1 },
  ])

  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ])
})

test("SameNetTraceCombiningSolver does NOT merge segments on same trace", () => {
  // Two non-adjacent horizontal segments on the SAME trace (different Y)
  // should NOT be merged even if they're collinear
  const traces: SolvedTracePath[] = [
    makeTrace("traceA", "net1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 0, y: 1 },
    ]),
    makeTrace("traceB", "net1", [
      { x: 0, y: 0.02 },
      { x: 2, y: 0.02 },
      { x: 2, y: 1 },
      { x: 0, y: 1 },
    ]),
  ]

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: createInputProblem(),
    allTraces: traces,
  })
  solver.solve()

  // Horizontal segments from traceA and traceB at Y~0 should merge
  // But traceA's second horizontal (Y=1) should NOT merge with traceA's first (Y=0)
  const output = solver.getOutput()
  // After merging the Y=0 segments, traceB should collapse
  const traceAPath = output.traces[0].tracePath
  // Trace A should still have non-merged segments
  expect(traceAPath.length).toBeGreaterThanOrEqual(3)
})

test("SameNetTraceCombiningSolver is compatible with empty inputs", () => {
  const solver = new SameNetTraceCombiningSolver({
    inputProblem: createInputProblem(),
    allTraces: [],
  })
  solver.solve()

  expect(solver.solved).toBe(true)
  const output = solver.getOutput()
  expect(output.traces).toHaveLength(0)
})
