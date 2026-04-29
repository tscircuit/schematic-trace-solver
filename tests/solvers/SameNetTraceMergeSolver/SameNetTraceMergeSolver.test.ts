import { test, expect } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Build a minimal SolvedTracePath for testing.
 */
function makeTrace(
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    globalConnNetId: netId,
    tracePath: path,
    mspConnectionPairIds: [],
    pinIds: [],
  } as unknown as SolvedTracePath
}

test("merges two close horizontal segments on the same net", () => {
  // Two traces on GND with horizontal segments at y=0.02 and y=-0.02 (gap=0.04 < threshold)
  const traces: SolvedTracePath[] = [
    makeTrace("A-B", "GND", [
      { x: -4, y: 0.02 },
      { x: 0, y: 0.02 },
    ]),
    makeTrace("A-C", "GND", [
      { x: -4, y: -0.02 },
      { x: 0, y: -0.02 },
    ]),
  ]

  const solver = new SameNetTraceMergeSolver({ allTraces: traces })
  solver.solve()

  const { traces: result } = solver.getOutput()
  const yA = result[0].tracePath[0].y
  const yB = result[1].tracePath[0].y

  // Both segments must be snapped to the same Y (their median = 0)
  expect(yA).toBeCloseTo(0, 5)
  expect(yB).toBeCloseTo(0, 5)
  expect(yA).toBeCloseTo(yB, 5)
})

test("merges two close vertical segments on the same net", () => {
  const traces: SolvedTracePath[] = [
    makeTrace("P-Q", "VCC", [
      { x: 0.02, y: -3 },
      { x: 0.02, y: 0 },
    ]),
    makeTrace("P-R", "VCC", [
      { x: -0.02, y: -3 },
      { x: -0.02, y: 0 },
    ]),
  ]

  const solver = new SameNetTraceMergeSolver({ allTraces: traces })
  solver.solve()

  const { traces: result } = solver.getOutput()
  const xA = result[0].tracePath[0].x
  const xB = result[1].tracePath[0].x

  expect(xA).toBeCloseTo(0, 5)
  expect(xB).toBeCloseTo(0, 5)
  expect(xA).toBeCloseTo(xB, 5)
})

test("does NOT merge segments on different nets", () => {
  const traces: SolvedTracePath[] = [
    makeTrace("A-B", "GND", [
      { x: -4, y: 0.02 },
      { x: 0, y: 0.02 },
    ]),
    makeTrace("C-D", "VCC", [
      // different net — must not snap
      { x: -4, y: -0.02 },
      { x: 0, y: -0.02 },
    ]),
  ]

  const solver = new SameNetTraceMergeSolver({ allTraces: traces })
  solver.solve()

  const { traces: result } = solver.getOutput()
  // Y values must remain unchanged
  expect(result[0].tracePath[0].y).toBeCloseTo(0.02, 5)
  expect(result[1].tracePath[0].y).toBeCloseTo(-0.02, 5)
})

test("does NOT merge segments that are too far apart", () => {
  // Gap = 0.2 > GAP_THRESHOLD (0.05)
  const traces: SolvedTracePath[] = [
    makeTrace("A-B", "GND", [
      { x: -4, y: 0.1 },
      { x: 0, y: 0.1 },
    ]),
    makeTrace("A-C", "GND", [
      { x: -4, y: -0.1 },
      { x: 0, y: -0.1 },
    ]),
  ]

  const solver = new SameNetTraceMergeSolver({ allTraces: traces })
  solver.solve()

  const { traces: result } = solver.getOutput()
  expect(result[0].tracePath[0].y).toBeCloseTo(0.1, 5)
  expect(result[1].tracePath[0].y).toBeCloseTo(-0.1, 5)
})

test("does NOT merge non-overlapping segments", () => {
  // Same net, same Y gap (0.02), but X ranges do not overlap
  const traces: SolvedTracePath[] = [
    makeTrace("A-B", "GND", [
      { x: -4, y: 0.02 },
      { x: -2, y: 0.02 },
    ]),
    makeTrace("A-C", "GND", [
      { x: 1, y: -0.02 },
      { x: 4, y: -0.02 },
    ]),
  ]

  const solver = new SameNetTraceMergeSolver({ allTraces: traces })
  solver.solve()

  const { traces: result } = solver.getOutput()
  expect(result[0].tracePath[0].y).toBeCloseTo(0.02, 5)
  expect(result[1].tracePath[0].y).toBeCloseTo(-0.02, 5)
})

test("end-to-end: pipeline produces merged traces for example with close same-net segments", () => {
  const { SchematicTracePipelineSolver } = require("lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver")
  const { inputProblem } = require("site/examples/example28-same-net-trace-merge.page")

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBeFalsy()

  // Verify the SameNetTraceMergeSolver ran and produced output
  const mergedTraces = solver.sameNetTraceMergeSolver?.getOutput().traces
  expect(mergedTraces).toBeDefined()
  expect(mergedTraces!.length).toBeGreaterThan(0)
})
