import { test, expect } from "bun:test"
import { SameNetTraceCombiningSolver } from "lib/solvers/SameNetTraceCombiningSolver/SameNetTraceCombiningSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * Construct a minimal pair of same-net trace paths that the existing solvers
 * would emit when three pins land on the same horizontal axis but get routed
 * by two independent MSP pairs. The two horizontal segments live at y = 0 and
 * y = 0.05 — visibly duplicated in a render but on different traces.
 *
 * After SameNetTraceCombiningSolver runs we expect both horizontal segments
 * to share a single y coordinate and a junction to be recorded at the
 * connecting endpoint.
 */
function buildFixture(): {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
} {
  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const baseTrace = {
    dcConnNetId: "net-A",
    globalConnNetId: "net-A",
    pins: [] as any,
    mspConnectionPairIds: [],
    pinIds: [],
  }

  const traces: SolvedTracePath[] = [
    {
      ...baseTrace,
      mspPairId: "pair-1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    },
    {
      ...baseTrace,
      mspPairId: "pair-2",
      // Parallel and 0.05 above pair-1, with full overlap on x.
      tracePath: [
        { x: 0.2, y: 0.05 },
        { x: 0.8, y: 0.05 },
      ],
    },
  ]

  return { inputProblem, traces }
}

test("SameNetTraceCombiningSolver merges close-parallel same-net segments", () => {
  const { inputProblem, traces } = buildFixture()
  const solver = new SameNetTraceCombiningSolver({
    inputProblem,
    traces,
  })
  solver.solve()

  expect(solver.solved).toBe(true)
  const out = solver.getOutput()
  expect(out.mergeCount).toBe(1)

  // Both horizontal segments should now sit on the same y coordinate.
  const ys = out.traces.flatMap((t) => t.tracePath.map((p) => p.y))
  expect(new Set(ys).size).toBe(1)
  expect(ys[0]).toBe(0)

  // Junction recorded for the merge.
  expect(out.junctions.length).toBeGreaterThanOrEqual(1)
  expect(out.junctions[0]!.netId).toBe("net-A")
})

test("SameNetTraceCombiningSolver does not merge different nets", () => {
  const { inputProblem } = buildFixture()
  const baseA = {
    dcConnNetId: "net-A",
    globalConnNetId: "net-A",
    pins: [] as any,
    mspConnectionPairIds: [],
    pinIds: [],
  }
  const baseB = {
    dcConnNetId: "net-B",
    globalConnNetId: "net-B",
    pins: [] as any,
    mspConnectionPairIds: [],
    pinIds: [],
  }
  const traces: SolvedTracePath[] = [
    {
      ...baseA,
      mspPairId: "pair-1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    },
    {
      ...baseB,
      mspPairId: "pair-2",
      tracePath: [
        { x: 0.2, y: 0.05 },
        { x: 0.8, y: 0.05 },
      ],
    },
  ]

  const solver = new SameNetTraceCombiningSolver({ inputProblem, traces })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.getOutput().mergeCount).toBe(0)
})

test("SameNetTraceCombiningSolver leaves far-apart same-net segments alone", () => {
  const { inputProblem } = buildFixture()
  const base = {
    dcConnNetId: "net-A",
    globalConnNetId: "net-A",
    pins: [] as any,
    mspConnectionPairIds: [],
    pinIds: [],
  }
  const traces: SolvedTracePath[] = [
    {
      ...base,
      mspPairId: "pair-1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    },
    {
      ...base,
      mspPairId: "pair-2",
      // 1.0 apart — well outside default mergeDistance (0.15).
      tracePath: [
        { x: 0, y: 1.0 },
        { x: 1, y: 1.0 },
      ],
    },
  ]

  const solver = new SameNetTraceCombiningSolver({ inputProblem, traces })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.getOutput().mergeCount).toBe(0)
})

test("SameNetTraceCombiningSolver requires meaningful overlap", () => {
  const { inputProblem } = buildFixture()
  const base = {
    dcConnNetId: "net-A",
    globalConnNetId: "net-A",
    pins: [] as any,
    mspConnectionPairIds: [],
    pinIds: [],
  }
  const traces: SolvedTracePath[] = [
    {
      ...base,
      mspPairId: "pair-1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    },
    {
      ...base,
      mspPairId: "pair-2",
      // Touches at x=1 only, no real overlap.
      tracePath: [
        { x: 1, y: 0.05 },
        { x: 2, y: 0.05 },
      ],
    },
  ]

  const solver = new SameNetTraceCombiningSolver({ inputProblem, traces })
  solver.solve()
  expect(solver.getOutput().mergeCount).toBe(0)
})
