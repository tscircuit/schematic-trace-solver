import { expect, test } from "bun:test"
import type { SchematicText } from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"

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
          displayName: "",
          x: -1,
          y: 1.3,
          _facingDirection: "x-",
        },
        {
          pinId: "U1.GND_RIGHT",
          displayName: "",
          x: 1,
          y: 1.3,
          _facingDirection: "x+",
        },
        {
          pinId: "U1.GND_BOTTOM",
          displayName: "",
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
          displayName: "",
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

  const annotations: SchematicText[] = [
    {
      type: "schematic_text",
      schematic_text_id: "repro_title",
      text: "BUG: endpoint ground symbols became inline labels",
      position: { x: 0, y: 2.45 },
      rotation: 0,
      anchor: "center",
      font_size: 0.16,
      color: "#b91c1c",
    },
    {
      type: "schematic_text",
      schematic_text_id: "left_expected_ground_symbol",
      text: "EXPECTED: ground symbol here →",
      position: { x: -2.05, y: 1.65 },
      rotation: 0,
      anchor: "center",
      font_size: 0.12,
      color: "#b91c1c",
    },
    {
      type: "schematic_text",
      schematic_text_id: "right_expected_ground_symbol",
      text: "← EXPECTED: ground symbol here",
      position: { x: 2.05, y: 1.65 },
      rotation: 0,
      anchor: "center",
      font_size: 0.12,
      color: "#b91c1c",
    },
    {
      type: "schematic_text",
      schematic_text_id: "routed_inline_label_expected",
      text: "← EXPECTED: inline GND2 only on this routed trace",
      position: { x: 1.4, y: -0.75 },
      rotation: 0,
      anchor: "center",
      font_size: 0.12,
      color: "#15803d",
    },
  ]
  const circuitJson = [
    ...convertSolverOutputToCircuitJson(solver),
    ...annotations,
  ]
  const annotatedSvg = convertCircuitJsonToSchematicSvg(circuitJson, {
    width: 1200,
    height: 800,
  })

  expect(annotatedSvg).toMatchSvgSnapshot(import.meta.path)
})
