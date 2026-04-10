import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * Full-pipeline regression test for issue #79.
 *
 * A circuit where GND/VCC pins are connected exclusively via netConnections
 * with availableNetLabelOrientations should produce:
 *   - net labels for GND and VCC (placed by NetLabelPlacementSolver)
 *   - NO wire trace segments connecting GND pins to each other
 *   - NO wire trace segments connecting VCC pins to each other
 *
 * Before the fix the solver was queueing every net (including purely
 * label-only ones) for MSP pair generation, which produced a spurious trace
 * alongside the net label.
 */
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 2.4,
      height: 1.0,
      pins: [
        { pinId: "U1.1", x: -1.2, y: 0.3 },   // VCC
        { pinId: "U1.2", x: -1.2, y: 0.1 },   // signal A
        { pinId: "U1.3", x: -1.2, y: -0.3 },  // GND
        { pinId: "U1.4", x: 1.2, y: 0.3 },    // signal B
      ],
    },
    {
      chipId: "R1",
      center: { x: 2.5, y: 0.3 },
      width: 1.0,
      height: 0.4,
      pins: [
        { pinId: "R1.1", x: 2.0, y: 0.3 },
        { pinId: "R1.2", x: 3.0, y: 0.3 },
      ],
    },
    {
      chipId: "C1",
      center: { x: -2.5, y: -0.3 },
      width: 0.5,
      height: 0.8,
      pins: [
        { pinId: "C1.1", x: -2.5, y: 0.1 },   // VCC
        { pinId: "C1.2", x: -2.5, y: -0.7 },  // GND
      ],
    },
  ],
  directConnections: [
    // Only signal connections are drawn as wire traces
    { pinIds: ["U1.4", "R1.1"], netId: "U1.out to R1.pin1" },
    { pinIds: ["U1.2", "R1.2"], netId: "U1.sigA to R1.pin2" },
  ],
  netConnections: [
    // Power rails — represented by net labels, no wire trace wanted
    { netId: "VCC", pinIds: ["U1.1", "C1.1"] },
    { netId: "GND", pinIds: ["U1.3", "C1.2"] },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 5,
}

test("repro issue #79: no spurious traces for net-label-only power rails", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)

  // Collect all pin IDs involved in VCC / GND net connections
  const vccPins = new Set(["U1.1", "C1.1"])
  const gndPins = new Set(["U1.3", "C1.2"])

  const traces =
    solver.traceCleanupSolver?.getOutput().traces ??
    solver.traceLabelOverlapAvoidanceSolver?.getOutput().traces ??
    []

  // No trace should connect two VCC-only pins or two GND-only pins.
  // A trace "connects" two pins if its path starts at one and ends at the other.
  for (const trace of traces) {
    const pts = trace.route
    if (!pts || pts.length < 2) continue

    const startPinId = (trace as any).startPinId as string | undefined
    const endPinId = (trace as any).endPinId as string | undefined

    if (startPinId && endPinId) {
      const isSpuriousVCC = vccPins.has(startPinId) && vccPins.has(endPinId)
      const isSpuriousGND = gndPins.has(startPinId) && gndPins.has(endPinId)
      expect(isSpuriousVCC).toBe(false)
      expect(isSpuriousGND).toBe(false)
    }
  }

  // Net labels for VCC and GND must have been placed
  const labels =
    solver.netLabelPlacementSolver?.netLabelPlacements ?? []
  const labelNets = labels.map((l) => l.netId ?? l.pinId)

  const hasVCCLabel = labelNets.some(
    (id) => typeof id === "string" && id.toLowerCase().includes("vcc"),
  )
  const hasGNDLabel = labelNets.some(
    (id) => typeof id === "string" && id.toLowerCase().includes("gnd"),
  )

  expect(hasVCCLabel).toBe(true)
  expect(hasGNDLabel).toBe(true)
})
