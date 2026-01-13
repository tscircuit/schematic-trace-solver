import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

/**
 * Test for Issue #34: Merge same-net trace lines that are close together
 *
 * This test creates a scenario where multiple traces belong to the same net
 * and are positioned close together (nearly parallel). The expected behavior
 * is that these traces should be merged into a single path.
 */

// Input problem that creates close parallel traces on the same net
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1.6,
      height: 1.2,
      pins: [
        { pinId: "U1.1", x: -0.8, y: 0.4 },
        { pinId: "U1.2", x: -0.8, y: 0 },
        { pinId: "U1.3", x: -0.8, y: -0.4 },
        { pinId: "U1.4", x: 0.8, y: -0.4 },
        { pinId: "U1.5", x: 0.8, y: 0 },
        { pinId: "U1.6", x: 0.8, y: 0.4 },
      ],
    },
    {
      chipId: "C1",
      center: { x: -3, y: 0.5 },
      width: 0.4,
      height: 0.8,
      pins: [
        { pinId: "C1.1", x: -3, y: 0.9 },
        { pinId: "C1.2", x: -3, y: 0.1 },
      ],
    },
    {
      chipId: "C2",
      center: { x: -3, y: -0.5 },
      width: 0.4,
      height: 0.8,
      pins: [
        { pinId: "C2.1", x: -3, y: -0.1 },
        { pinId: "C2.2", x: -3, y: -0.9 },
      ],
    },
  ],
  // Multiple pins connected to the same GND net
  // This should create traces that could be merged
  netConnections: [
    {
      pinIds: ["U1.3", "C1.2", "C2.1"],
      netId: "GND",
    },
  ],
  directConnections: [
    {
      pinIds: ["U1.1", "C1.1"],
      netId: "VCC",
    },
    {
      pinIds: ["U1.2", "C2.2"],
      netId: "SIG",
    },
  ],
  availableNetLabelOrientations: {
    GND: ["y-"],
    VCC: ["y+"],
    SIG: ["x-"],
  },
  maxMspPairDistance: 5,
}

test("should merge same-net trace lines that are close together", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  // Get all traces and analyze them
  const traceLinesSolver = solver.schematicTraceLinesSolver!
  const allTraces = traceLinesSolver.solvedTracePaths

  // Log all trace information for debugging
  console.log("=== Before Merger (SchematicTraceLinesSolver) ===")
  console.log("Total traces count:", allTraces.length)
  for (const trace of allTraces) {
    console.log(
      `Trace: globalConnNetId=${trace.globalConnNetId}, dcConnNetId=${trace.dcConnNetId}`,
    )
    console.log("  Path:", JSON.stringify(trace.tracePath))
    console.log("  Pins:", trace.pinIds)
  }

  // Get merged traces
  const traceMergerSolver = solver.traceMergerSolver
  if (traceMergerSolver) {
    console.log("\n=== After Merger (TraceMergerSolver) ===")
    const mergedTraces = traceMergerSolver.mergedTracePaths
    console.log("Total merged traces count:", mergedTraces.length)
    for (const trace of mergedTraces) {
      console.log(`Trace: globalConnNetId=${trace.globalConnNetId}`)
      console.log("  Path:", JSON.stringify(trace.tracePath))
    }
  }

  // Check if there are traces that could be merged
  // (traces on the same net with segments close together)
  expect(solver.solved).toBe(true)

  // Visual snapshot for before/after comparison
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
