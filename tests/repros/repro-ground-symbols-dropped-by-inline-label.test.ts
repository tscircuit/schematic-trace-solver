import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 1 },
      width: 2,
      height: 2,
      pins: [
        {
          pinId: "U1.GND_LEFT",
          displayName: "GND_LEFT",
          x: -1,
          y: 1.3,
          _facingDirection: "x-",
        },
        {
          pinId: "U1.GND_RIGHT",
          displayName: "GND_RIGHT",
          x: 1,
          y: 1.3,
          _facingDirection: "x+",
        },
        {
          pinId: "U1.GND_BOTTOM",
          displayName: "GND_BOTTOM",
          x: 0,
          y: 0,
          _facingDirection: "y-",
        },
      ],
    },
    {
      chipId: "R1",
      center: { x: 0, y: -2 },
      width: 0.6,
      height: 1,
      pins: [
        {
          pinId: "R1.GND",
          displayName: "GND",
          x: 0,
          y: -1.5,
          _facingDirection: "y+",
        },
      ],
    },
  ],
  directConnections: [
    { pinIds: ["U1.GND_BOTTOM", "R1.GND"], netId: "GND2_TRACE" },
  ],
  netConnections: [
    {
      netId: "GND2",
      netLabelText: "GND2",
      pinIds: ["U1.GND_LEFT", "U1.GND_RIGHT", "U1.GND_BOTTOM", "R1.GND"],
      isGround: true,
      allowInlineNetLabel: true,
      netLabelWidth: 0.6,
      anchoredNetLabelWidth: 0.6,
      inlineNetLabelWidth: 0.4,
      inlineNetLabelHeight: 0.12,
    },
  ],
  availableNetLabelOrientations: { GND2: ["y-"] },
  maxMspPairDistance: 2.4,
}

// GND2 has one explicitly routed branch and two disconnected chip pins. The
// routed branch may use an inline label, but the chip pins should keep their
// anchored ground symbols. The current output replaces all three placements
// with inline labels, including terminal stubs at the left and right pins.
test("repro: inline GND2 label replaces anchored ground symbols", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const inlineSolver = solver.inlineNetLabelSolver!
  const inputGroundLabels = inlineSolver.inputNetLabelPlacements.filter(
    (placement) => placement.netId === "GND2",
  )
  const output = inlineSolver.getOutput()
  const outputGroundLabels = output.netLabelPlacements.filter(
    (placement) => placement.netId === "GND2",
  )
  const inlineGroundLabels = output.inlineNetLabelPlacements.filter(
    (placement) => placement.netId === "GND2",
  )

  expect(inputGroundLabels).toHaveLength(3)
  expect(inputGroundLabels.map((placement) => placement.orientation)).toEqual([
    "y-",
    "y-",
    "y-",
  ])
  expect(
    inputGroundLabels.filter(
      (placement) => placement.mspConnectionPairIds.length === 0,
    ),
  ).toHaveLength(2)
  expect(inlineGroundLabels).toHaveLength(3)
  expect(
    inlineGroundLabels.filter(
      (placement) => placement.stubTracePath !== undefined,
    ),
  ).toHaveLength(2)
  expect(outputGroundLabels).toHaveLength(0)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
