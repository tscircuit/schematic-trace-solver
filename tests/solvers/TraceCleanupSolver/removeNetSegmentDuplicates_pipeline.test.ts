import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

/**
 * This test verifies that duplicate trace segments are removed in the
 * post-processing step when multiple MSP connection pairs in the same net
 * share a pin endpoint.
 *
 * The input problem has a 3-pin net (net1: p1, p2, p3) which will create
 * MSP pairs that share endpoints. Without deduplication, both traces would
 * include overlapping segments near the shared pin.
 */
test("pipeline removes duplicate trace segments from shared-pin nets", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "chip1",
        center: { x: -2, y: 0 },
        width: 1,
        height: 2,
        pins: [
          { pinId: "chip1.1", x: -2.5, y: 0.5 },
          { pinId: "chip1.2", x: -2.5, y: -0.5 },
        ],
      },
      {
        chipId: "chip2",
        center: { x: 2, y: 0 },
        width: 1,
        height: 2,
        pins: [
          { pinId: "chip2.1", x: 2.5, y: 0.5 },
          { pinId: "chip2.2", x: 2.5, y: -0.5 },
        ],
      },
      {
        chipId: "chip3",
        center: { x: 0, y: 3 },
        width: 1,
        height: 1,
        pins: [{ pinId: "chip3.1", x: 0, y: 2.5 }],
      },
    ],
    directConnections: [
      { pinIds: ["chip1.1", "chip2.1"], netId: "net1" },
      { pinIds: ["chip1.1", "chip3.1"], netId: "net1" },
    ],
    netConnections: [
      {
        netId: "net1",
        pinIds: ["chip1.1", "chip2.1", "chip3.1"],
      },
    ],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 6,
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  // Get the final traces from the cleanup solver
  const traces = solver.traceCleanupSolver?.getOutput().traces ?? []

  // Collect all segments across all traces
  const allSegments: string[] = []
  for (const trace of traces) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const p1 = trace.tracePath[i]
      const p2 = trace.tracePath[i + 1]
      // Create direction-independent key
      const [ax, ay, bx, by] =
        p1.x < p2.x || (p1.x === p2.x && p1.y < p2.y)
          ? [p1.x, p1.y, p2.x, p2.y]
          : [p2.x, p2.y, p1.x, p1.y]
      allSegments.push(
        `${ax.toFixed(6)},${ay.toFixed(6)}-${bx.toFixed(6)},${by.toFixed(6)}`,
      )
    }
  }

  // Check that no segment appears more than once
  const segmentCounts = new Map<string, number>()
  for (const seg of allSegments) {
    segmentCounts.set(seg, (segmentCounts.get(seg) ?? 0) + 1)
  }

  const duplicates = Array.from(segmentCounts.entries()).filter(
    ([_, count]) => count > 1,
  )

  expect(duplicates).toHaveLength(0)
})

/**
 * Regression test using example02's input problem structure, which has
 * multi-pin nets (VSYS with 5 pins, GND with 5 pins) known to produce
 * extra trace lines before the fix.
 */
test("example02-style multi-pin nets have no duplicate segments", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "c1",
        center: { x: -2, y: 0.5 },
        width: 0.5,
        height: 1,
        pins: [
          { pinId: "C1.1", x: -2, y: 1 },
          { pinId: "C1.2", x: -2, y: 0 },
        ],
      },
      {
        chipId: "c2",
        center: { x: -1, y: 0.5 },
        width: 0.5,
        height: 1,
        pins: [
          { pinId: "C2.1", x: -1, y: 1 },
          { pinId: "C2.2", x: -1, y: 0 },
        ],
      },
      {
        chipId: "u1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 0.6,
        pins: [
          { pinId: "U1.1", x: -0.5, y: 0.1 },
          { pinId: "U1.2", x: -0.5, y: -0.1 },
          { pinId: "U1.3", x: 0.5, y: 0 },
        ],
      },
    ],
    directConnections: [
      { pinIds: ["U1.1", "C1.1"], netId: "VIN" },
      { pinIds: ["U1.1", "C2.1"], netId: "VIN" },
      { pinIds: ["U1.2", "C1.2"], netId: "GND" },
      { pinIds: ["U1.2", "C2.2"], netId: "GND" },
    ],
    netConnections: [
      { netId: "VIN", pinIds: ["U1.1", "C1.1", "C2.1"] },
      { netId: "GND", pinIds: ["U1.2", "C1.2", "C2.2"] },
    ],
    availableNetLabelOrientations: {
      VIN: ["y+"],
      GND: ["y-"],
    },
    maxMspPairDistance: 2,
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)

  const traces = solver.traceCleanupSolver?.getOutput().traces ?? []

  // Collect all segments
  const allSegments: string[] = []
  for (const trace of traces) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const p1 = trace.tracePath[i]
      const p2 = trace.tracePath[i + 1]
      const [ax, ay, bx, by] =
        p1.x < p2.x || (p1.x === p2.x && p1.y < p2.y)
          ? [p1.x, p1.y, p2.x, p2.y]
          : [p2.x, p2.y, p1.x, p1.y]
      allSegments.push(
        `${ax.toFixed(6)},${ay.toFixed(6)}-${bx.toFixed(6)},${by.toFixed(6)}`,
      )
    }
  }

  const segmentCounts = new Map<string, number>()
  for (const seg of allSegments) {
    segmentCounts.set(seg, (segmentCounts.get(seg) ?? 0) + 1)
  }

  const duplicates = Array.from(segmentCounts.entries()).filter(
    ([_, count]) => count > 1,
  )

  expect(duplicates).toHaveLength(0)
})
