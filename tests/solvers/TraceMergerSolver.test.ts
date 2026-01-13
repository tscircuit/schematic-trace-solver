import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { TraceMergerSolver } from "lib/solvers/TraceMergerSolver/TraceMergerSolver"
import type { InputProblem } from "lib/types/InputProblem"
import {
  getSvgFromGraphicsObject,
  stackGraphicsHorizontally,
} from "graphics-debug"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import "tests/fixtures/matcher"

/**
 * Test for Issue #34: Merge same-net trace lines that are close together
 *
 * This test demonstrates the problem where traces on the same net have
 * parallel segments that are very close together (within MERGE_THRESHOLD).
 * The TraceMergerSolver should merge these close parallel lines into one.
 */

// Input problem that creates close parallel traces on the same net
// The GND net connects multiple pins, creating traces with segments
// that can be close together and should be merged
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
  // This creates traces that may have close parallel segments
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

/**
 * Helper to visualize traces on an input problem
 */
function visualizeWithTraces(
  problem: InputProblem,
  traces: Array<{ tracePath: Array<{ x: number; y: number }> }>,
  color: string,
) {
  const graphics = visualizeInputProblem(problem)
  graphics.lines = graphics.lines || []

  for (const trace of traces) {
    graphics.lines.push({
      points: trace.tracePath,
      strokeColor: color,
    })
  }

  return graphics
}

test("TraceMergerSolver: before/after comparison showing merge of close parallel traces", () => {
  // Run the full pipeline solver
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  // Get the traces before merger (from SchematicTraceLinesSolver)
  const traceLinesSolver = solver.schematicTraceLinesSolver!
  const tracesBeforeMerger = traceLinesSolver.solvedTracePaths

  // Get the traces after merger
  const traceMergerSolver = solver.traceMergerSolver!
  const tracesAfterMerger = traceMergerSolver.mergedTracePaths

  // Create before visualization (red traces)
  const beforeGraphics = visualizeWithTraces(
    inputProblem,
    tracesBeforeMerger,
    "red",
  )

  // Create after visualization (green traces)
  const afterGraphics = visualizeWithTraces(
    inputProblem,
    tracesAfterMerger,
    "green",
  )

  // Stack side by side for comparison
  const sideBySide = getSvgFromGraphicsObject(
    stackGraphicsHorizontally([beforeGraphics, afterGraphics], {
      titles: ["Before Merger (red)", "After Merger (green)"],
    }),
    {
      backgroundColor: "white",
    },
  )

  // Snapshot the comparison
  expect(sideBySide).toMatchSvgSnapshot(
    import.meta.path,
    "before_after_comparison",
  )

  // Verify the solver completed successfully
  expect(solver.solved).toBe(true)
})

test("TraceMergerSolver: pipeline solver snapshot", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
