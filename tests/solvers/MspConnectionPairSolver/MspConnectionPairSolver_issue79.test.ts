import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * Regression test for issue #79:
 * "Fix extra net label in repro61, or remove trace"
 *
 * Nets connected exclusively via netConnections with an availableNetLabelOrientation
 * (e.g. VCC, GND) should NOT generate routed wire traces — they are represented
 * by net labels only. Before the fix, MspConnectionPairSolver queued ALL nets
 * including label-only ones, producing spurious extra trace lines.
 */
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 2.4,
      height: 1.0,
      pins: [
        { pinId: "U1.vcc", x: -1.2, y: 0.3 },
        { pinId: "U1.sig", x: -1.2, y: 0.0 },
        { pinId: "U1.gnd", x: -1.2, y: -0.3 },
        { pinId: "U1.out", x: 1.2, y: 0.0 },
      ],
    },
    {
      chipId: "R1",
      center: { x: 2.5, y: 0.0 },
      width: 1.0,
      height: 0.4,
      pins: [
        { pinId: "R1.a", x: 2.0, y: 0.0 },
        { pinId: "R1.b", x: 3.0, y: 0.0 },
      ],
    },
    {
      chipId: "C1",
      center: { x: -2.5, y: -0.3 },
      width: 0.5,
      height: 0.8,
      pins: [
        { pinId: "C1.vcc", x: -2.5, y: 0.1 },
        { pinId: "C1.gnd", x: -2.5, y: -0.7 },
      ],
    },
  ],
  // Only U1.out→R1.a is a direct wired connection
  directConnections: [{ pinIds: ["U1.out", "R1.a"], netId: "signal" }],
  // VCC and GND are net-label-only connections
  netConnections: [
    { netId: "VCC", pinIds: ["U1.vcc", "C1.vcc"] },
    { netId: "GND", pinIds: ["U1.gnd", "C1.gnd"] },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
}

test("issue #79: net-label-only nets are not routed as wire traces", () => {
  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  // Only the directly-wired "signal" net should be queued/routed
  const netIds = solver.mspConnectionPairs.map((p) => p.dcConnNetId)
  expect(netIds.every((id) => id !== "VCC" && id !== "GND")).toBe(true)
  // The direct connection should still be routed
  expect(solver.mspConnectionPairs.length).toBeGreaterThan(0)
})

test("issue #79: pipeline produces no traces for label-only nets", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem)
  pipeline.solve()

  expect(pipeline.solved).toBe(true)

  // Get all traces from the pipeline output
  const traces = pipeline.traceCleanupSolver?.getOutput().traces ?? []

  // No trace should be for VCC or GND net IDs
  const vccOrGndTraces = traces.filter(
    (t) => t.dcConnNetId === "VCC" || t.dcConnNetId === "GND",
  )
  expect(vccOrGndTraces.length).toBe(0)
})
