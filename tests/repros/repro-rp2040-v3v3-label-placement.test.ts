import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const createRp2040SidePins = (side: "left" | "right") =>
  Array.from({ length: 22 }, (_, index) => ({
    pinId: `U1.${side}.${index + 1}`,
    x: side === "left" ? -1.35 : 1.35,
    y: 2.8 - index * 0.2,
    _facingDirection: side === "left" ? ("x-" as const) : ("x+" as const),
  }))

// Reduced from the current @tscircuit/core input for an RP2040, then mirrored
// to cover both chip sides. The important details are the 0.2-unit pin pitch,
// 0.6-unit rail-label height, and a third distance-split member on each net.
// The reversed first pair preserves the MSP direction produced by the original
// multi-pin input (pin 10 to pin 1).
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1.9,
      height: 6,
      pins: [...createRp2040SidePins("left"), ...createRp2040SidePins("right")],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "V3V3_LEFT",
      pinIds: ["U1.left.10", "U1.left.1", "U1.left.22"],
      netLabelWidth: 0.42,
      netLabelHeight: 0.6,
    },
    {
      netId: "V3V3_RIGHT",
      pinIds: ["U1.right.10", "U1.right.1", "U1.right.22"],
      netLabelWidth: 0.42,
      netLabelHeight: 0.6,
    },
  ],
  textBoxes: [
    {
      chipId: "U1",
      center: { x: -0.83, y: 3.115 },
      width: 0.36,
      height: 0.25,
      text: "U1",
    },
  ],
  availableNetLabelOrientations: {
    V3V3_LEFT: ["y+"],
    V3V3_RIGHT: ["y+"],
  },
  maxMspPairDistance: 2.4,
}

test("places RP2040 rail labels above and outside both chip sides", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const outputLabels =
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements
  const u1 = solver.inputProblem.chips.find((chip) => chip.chipId === "U1")!
  const chipLeft = u1.center.x - u1.width / 2
  const chipRight = u1.center.x + u1.width / 2

  for (const side of ["left", "right"] as const) {
    const netId = `V3V3_${side.toUpperCase()}`
    const label = outputLabels.find(
      (candidate) =>
        candidate.netId === netId && candidate.pinIds.includes(`U1.${side}.1`),
    )!
    const connector = solver.availableNetOrientationSolver!.traces.find(
      (trace) =>
        trace.userNetId === netId &&
        trace.mspPairId.startsWith("available-net-orientation-"),
    )!
    const [connectorSource, connectorTarget] = connector.tracePath
    const labelLeft = label.center.x - label.width / 2
    const labelRight = label.center.x + label.width / 2

    expect(label.orientation).toBe("y+")
    expect(label.anchorPoint.y).toBeCloseTo(2.8)
    expect(connector.tracePath).toHaveLength(2)
    expect(connectorSource!.y).toBeCloseTo(connectorTarget!.y)
    expect(Math.abs(connectorSource!.x - connectorTarget!.x)).toBeLessThan(0.5)

    if (side === "left") {
      expect(labelRight).toBeLessThan(chipLeft)
      expect(connectorTarget!.x).toBeLessThan(connectorSource!.x)
    } else {
      expect(labelLeft).toBeGreaterThan(chipRight)
      expect(connectorTarget!.x).toBeGreaterThan(connectorSource!.x)
    }
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
