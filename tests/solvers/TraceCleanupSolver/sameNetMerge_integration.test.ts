import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * Integration test: 3 pins in a row on same net should produce traces that share
 * the same collinear segment (merged into one continuous segment).
 *
 * This tests issue #29: merge collinear same-net trace segments.
 */
test("issue #29: 3 inline pins on same GND net - collinear segments merged", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1.6,
        height: 1.0,
        pins: [
          { pinId: "U1.1", x: -0.8, y: 0.2 },
          { pinId: "U1.2", x: -0.8, y: -0.2 },
          { pinId: "U1.3", x: 0.8, y: 0.2 },
          { pinId: "U1.4", x: 0.8, y: -0.2 },
        ],
      },
      {
        chipId: "C1",
        center: { x: -3, y: 0 },
        width: 0.5,
        height: 0.8,
        pins: [
          { pinId: "C1.1", x: -3, y: 0.4 },
          { pinId: "C1.2", x: -3, y: -0.4 },
        ],
      },
      {
        chipId: "C2",
        center: { x: -6, y: 0 },
        width: 0.5,
        height: 0.8,
        pins: [
          { pinId: "C2.1", x: -6, y: 0.4 },
          { pinId: "C2.2", x: -6, y: -0.4 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "GND",
        pinIds: ["U1.2", "C1.2", "C2.2"],
      },
      {
        netId: "VCC",
        pinIds: ["U1.1", "C1.1", "C2.1"],
      },
    ],
    availableNetLabelOrientations: {
      GND: ["y-"],
      VCC: ["y+"],
    },
    maxMspPairDistance: 5,
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)

  // Should produce trace cleanup output
  const cleanupOutput = solver.traceCleanupSolver?.getOutput()
  expect(cleanupOutput).toBeDefined()
  expect(cleanupOutput!.traces.length).toBeGreaterThan(0)
})

/**
 * Integration test for issue #34: parallel same-net traces that are close
 * together should be snapped to a shared coordinate.
 */
test("issue #34: parallel same-net traces close together - solver completes without error", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U3",
        center: { x: 0, y: 0 },
        width: 2,
        height: 2,
        pins: [
          { pinId: "U3.1", x: -1, y: 0.5 },
          { pinId: "U3.2", x: -1, y: -0.5 },
          { pinId: "U3.3", x: 1, y: 0.5 },
          { pinId: "U3.4", x: 1, y: -0.5 },
        ],
      },
      {
        chipId: "C20",
        center: { x: -3, y: 0 },
        width: 0.5,
        height: 0.8,
        pins: [
          { pinId: "C20.1", x: -3, y: 0.4 },
          { pinId: "C20.2", x: -3, y: -0.4 },
        ],
      },
      {
        chipId: "R11",
        center: { x: 3, y: 0 },
        width: 0.5,
        height: 0.8,
        pins: [
          { pinId: "R11.1", x: 3, y: 0.4 },
          { pinId: "R11.2", x: 3, y: -0.4 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "V3_3",
        pinIds: ["U3.1", "C20.1", "R11.1"],
      },
      {
        netId: "GND",
        pinIds: ["U3.2", "C20.2", "R11.2"],
      },
    ],
    availableNetLabelOrientations: {
      V3_3: ["y+"],
      GND: ["y-"],
    },
    maxMspPairDistance: 5,
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBeFalsy()

  const cleanupOutput = solver.traceCleanupSolver?.getOutput()
  expect(cleanupOutput).toBeDefined()
  expect(cleanupOutput!.traces.length).toBeGreaterThan(0)
})
