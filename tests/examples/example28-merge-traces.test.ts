import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("example28 - merge collinear traces on same net", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1.6,
        height: 0.6,
        pins: [
          {
            pinId: "U1.1",
            x: -0.8,
            y: 0.2,
          },
          {
            pinId: "U1.2",
            x: 0.8,
            y: 0.2,
          },
        ],
      },
      {
        chipId: "C1",
        center: { x: -2.5, y: 0 },
        width: 0.5,
        height: 1,
        pins: [
          {
            pinId: "C1.1",
            x: -2.5,
            y: 0.5,
          },
          {
            pinId: "C1.2",
            x: -2.5,
            y: -0.5,
          },
        ],
      },
      {
        chipId: "C2",
        center: { x: 2.5, y: 0 },
        width: 0.5,
        height: 1,
        pins: [
          {
            pinId: "C2.1",
            x: 2.5,
            y: 0.5,
          },
          {
            pinId: "C2.2",
            x: 2.5,
            y: -0.5,
          },
        ],
      },
      {
        chipId: "R1",
        center: { x: -4, y: 0 },
        width: 0.5,
        height: 1,
        pins: [
          {
            pinId: "R1.1",
            x: -4,
            y: 0.5,
          },
          {
            pinId: "R1.2",
            x: -4,
            y: -0.5,
          },
        ],
      },
    ],
    directConnections: [
      {
        pinIds: ["R1.1", "C1.1"],
        netId: "VCC",
      },
      {
        pinIds: ["C1.1", "U1.1"],
        netId: "VCC",
      },
      {
        pinIds: ["U1.2", "C2.1"],
        netId: "OUT",
      },
    ],
    netConnections: [
      {
        pinIds: ["R1.2", "C1.2", "C2.2"],
        netId: "GND",
      },
    ],
    availableNetLabelOrientations: {
      VCC: ["y+"],
      GND: ["y-"],
    },
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  // Verify that trace cleanup was executed
  expect(solver.traceCleanupSolver).toBeDefined()
  expect(solver.traceCleanupSolver!.solved).toBe(true)

  const output = solver.traceCleanupSolver!.getOutput()
  expect(output.traces.length).toBeGreaterThan(0)

  // Check that traces are properly formed (all paths have at least 2 points)
  for (const trace of output.traces) {
    expect(trace.tracePath.length).toBeGreaterThanOrEqual(2)

    // Check that all points are valid
    for (const point of trace.tracePath) {
      expect(typeof point.x).toBe("number")
      expect(typeof point.y).toBe("number")
      expect(Number.isFinite(point.x)).toBe(true)
      expect(Number.isFinite(point.y)).toBe(true)
    }
  }
})
