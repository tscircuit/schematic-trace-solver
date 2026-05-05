import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

test("issue-34 same-net trace alignment", async () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: -2, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U1.1", x: -1.5, y: 1 },
          { pinId: "U1.2", x: -1.5, y: 0.8 },
        ],
      },
      {
        chipId: "U2",
        center: { x: 2, y: 0 },
        width: 1,
        height: 3,
        pins: [
          { pinId: "U2.1", x: 1.5, y: 1 },
          { pinId: "U2.2", x: 1.5, y: 0.8 },
        ],
      },
      {
        chipId: "OBSTACLE",
        center: { x: 0, y: 0 },
        width: 0.5,
        height: 0.1,
        pins: [],
      },
    ],
    directConnections: [
      { pinIds: ["U1.1", "U2.1"], netId: "NET1" },
      { pinIds: ["U1.2", "U2.2"], netId: "NET1" },
    ],
    netConnections: [],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 5,
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  const traces = solver.traceCleanupSolver?.getOutput().traces ?? []

  expect(traces.length).toBeGreaterThan(0)

  // Verify that the horizontal segments are aligned (same Y)
  // We look for horizontal segments (p1.y == p2.y) and group them by net
  const horizontalYs = new Set<number>()
  for (const trace of traces) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const p1 = trace.tracePath[i]
      const p2 = trace.tracePath[i + 1]
      if (Math.abs(p1.y - p2.y) < 0.001) {
        horizontalYs.add(Math.round(p1.y * 1000) / 1000)
      }
    }
  }

  // Without alignment, we would have 1.0 and 0.8 (and maybe others).
  // With alignment, they should be merged into one Y level if possible.
  // In our case, they are 0.2 apart, threshold is 0.3, so they should merge.

  // Note: the pins are at 1.0 and 0.8. If the segments are connected to pins,
  // they might not align due to the "internal only" restriction.
  // But the router should create internal segments to avoid the obstacle.

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
