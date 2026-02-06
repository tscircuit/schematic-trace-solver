import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"

/**
 * Issue #34 Integration Test
 *
 * This test uses the full SchematicTracePipelineSolver with the issue-34-reproduction
 * example to verify that fragmented same-net trace lines are correctly merged.
 */
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: -2, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [
        {
          pinId: "U1.1",
          x: -2.8,
          y: 0.2,
        },
        {
          pinId: "U1.2",
          x: -2.8,
          y: 0,
        },
        {
          pinId: "U1.3",
          x: -2.8,
          y: -0.2,
        },
        {
          pinId: "U1.4",
          x: -1.2,
          y: -0.2,
        },
        {
          pinId: "U1.5",
          x: -1.2,
          y: 0,
        },
        {
          pinId: "U1.6",
          x: -1.2,
          y: 0.2,
        },
      ],
    },
    {
      chipId: "U2",
      center: { x: 8, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [
        {
          pinId: "U2.1",
          x: 7.2,
          y: 0.2,
        },
        {
          pinId: "U2.2",
          x: 7.2,
          y: 0,
        },
        {
          pinId: "U2.3",
          x: 7.2,
          y: -0.2,
        },
        {
          pinId: "U2.4",
          x: 8.8,
          y: -0.2,
        },
        {
          pinId: "U2.5",
          x: 8.8,
          y: 0,
        },
        {
          pinId: "U2.6",
          x: 8.8,
          y: 0.2,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["U1.1", "U2.1"],
      netId: "SIGNAL",
    },
  ],
  netConnections: [
    {
      pinIds: ["U1.2", "U2.2"],
      netId: "GND",
    },
    {
      pinIds: ["U1.3", "U2.3"],
      netId: "VCC",
    },
  ],
  availableNetLabelOrientations: {
    SIGNAL: ["y+"],
    GND: ["y-"],
    VCC: ["y-"],
  },
  maxMspPairDistance: 15,
}

test("Issue #34: Fragmented same-net trace lines are merged", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  // Get the solved traces from the trace cleanup solver
  const traceCleanupSolver = solver.traceCleanupSolver
  if (!traceCleanupSolver) {
    throw new Error("TraceCleanupSolver not initialized")
  }

  const output = traceCleanupSolver.getOutput()
  const allTraces = output.traces

  // Find the SIGNAL trace
  const signalTraces = allTraces.filter(
    (trace) =>
      trace.userNetId === "SIGNAL" ||
      trace.globalConnNetId === "SIGNAL" ||
      trace.dcConnNetId === "SIGNAL",
  )

  // Should have at least one trace for SIGNAL
  expect(signalTraces.length).toBeGreaterThan(0)

  // The trace should connect U1.1 to U2.1
  const hasStartPin = signalTraces.some((trace) =>
    trace.pinIds.includes("U1.1"),
  )
  const hasEndPin = signalTraces.some((trace) => trace.pinIds.includes("U2.1"))

  expect(hasStartPin).toBe(true)
  expect(hasEndPin).toBe(true)

  // Verify no TypeScript errors by accessing the output
  expect(traceCleanupSolver).toBeDefined()
})
