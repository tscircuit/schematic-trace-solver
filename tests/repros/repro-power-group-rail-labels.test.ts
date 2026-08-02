import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 2,
      height: 1.4,
      pins: [
        ...[0.5, 0.25, 0, -0.25, -0.5].map((y, index) => ({
          pinId: `U1.${index + 1}`,
          x: -1,
          y,
          _facingDirection: "x-" as const,
        })),
        ...[0.5, 0.25, 0, -0.25, -0.5].map((y, index) => ({
          pinId: `U1.${index + 6}`,
          x: 1,
          y,
          _facingDirection: "x+" as const,
        })),
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "VBAT",
      pinIds: ["U1.1", "U1.2", "U1.3"],
      netLabelWidth: 0.48,
      netLabelHeight: 0.48,
    },
    {
      netId: "GND",
      pinIds: ["U1.4", "U1.5"],
      netLabelWidth: 0.36,
      netLabelHeight: 0.48,
    },
  ],
  textBoxes: [
    {
      chipId: "U1",
      center: { x: -0.25, y: 0.85 },
      width: 0.7,
      height: 0.2,
      text: "U1 Power",
    },
  ],
  availableNetLabelOrientations: {
    VBAT: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 2.4,
}

test("places same-side VBAT and GND labels at opposite rail ends", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const outputLabels =
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements
  const u1 = solver.inputProblem.chips.find((chip) => chip.chipId === "U1")!
  const chipLeft = u1.center.x - u1.width / 2

  for (const expected of [
    { netId: "VBAT", orientation: "y+" as const, anchorY: 0.5 },
    { netId: "GND", orientation: "y-" as const, anchorY: -0.5 },
  ]) {
    const label = outputLabels.find(
      (candidate) => candidate.netId === expected.netId,
    )!
    const connector = solver.availableNetOrientationSolver!.traces.find(
      (trace) =>
        trace.userNetId === expected.netId &&
        trace.mspPairId.startsWith("available-net-orientation-"),
    )!
    const [connectorSource, connectorTarget] = connector.tracePath
    const labelRight = label.center.x + label.width / 2

    expect(label.orientation).toBe(expected.orientation)
    expect(label.anchorPoint.y).toBeCloseTo(expected.anchorY)
    expect(labelRight).toBeLessThan(chipLeft)
    expect(connector.tracePath).toHaveLength(2)
    expect(connectorSource!.y).toBeCloseTo(connectorTarget!.y)
    expect(connectorTarget!.x).toBeLessThan(connectorSource!.x)
    expect(connectorSource!.x - connectorTarget!.x).toBeLessThan(0.5)
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
