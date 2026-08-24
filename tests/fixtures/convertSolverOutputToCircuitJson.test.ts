import { expect, test } from "bun:test"
import { any_circuit_element, type SchematicTrace } from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "./convertSolverOutputToCircuitJson"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: [
        { pinId: "U1.1", x: 0.5, y: 0.2, _facingDirection: "x+" },
        { pinId: "U1.2", x: 0.5, y: -0.2, _facingDirection: "x+" },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: { x: 2, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C1.1", x: 2, y: 0.5, _facingDirection: "y+" },
        { pinId: "C1.2", x: 2, y: -0.5, _facingDirection: "y-" },
      ],
    },
  ],
  directConnections: [
    { pinIds: ["U1.1", "C1.1"], netId: "ROUTED" },
    { pinIds: ["U1.2", "C1.2"], netId: "UNROUTED" },
  ],
  netConnections: [],
  textBoxes: [
    {
      chipId: "schematic_component_0",
      center: { x: 0, y: -0.7 },
      width: 1,
      height: 0.2,
      text: "part number",
    },
  ],
  availableNetLabelOrientations: { ROUTED: ["x+"] },
}

class SnapshotTestSolver extends BaseSolver {
  inputProblem = inputProblem

  getOutput() {
    return {
      traces: [
        {
          mspPairId: "routed-trace",
          globalConnNetId: "ROUTED",
          userNetId: "ROUTED",
          pinIds: ["U1.1", "C1.1"],
          tracePath: [
            { x: 0.5, y: 0.2 },
            { x: 1.2, y: 0.2 },
            { x: 1.2, y: 0.5 },
            { x: 2, y: 0.5 },
          ],
        },
      ],
      netLabelPlacements: [
        {
          globalConnNetId: "ROUTED",
          netId: "ROUTED",
          mspConnectionPairIds: ["routed-trace"],
          pinIds: ["U1.1", "C1.1"],
          orientation: "x+" as const,
          anchorPoint: { x: 1.2, y: 0.2 },
          width: 0.8,
          height: 0.2,
          center: { x: 1.6, y: 0.2 },
        },
      ],
      inlineNetLabelPlacements: [],
    }
  }
}

test("solver snapshot Circuit JSON is semantic and omits the rats nest", () => {
  const circuitJson = convertSolverOutputToCircuitJson(new SnapshotTestSolver())

  for (const element of circuitJson) {
    expect(any_circuit_element.safeParse(element).success).toBe(true)
  }

  expect(
    circuitJson.filter((element) => element.type === "schematic_component"),
  ).toHaveLength(2)
  expect(
    circuitJson.find(
      (element) =>
        element.type === "schematic_component" &&
        element.source_component_id === "source_component_1",
    ),
  ).toMatchObject({ symbol_name: "capacitor_up" })
  expect(
    circuitJson.filter((element) => element.type === "schematic_box"),
  ).toHaveLength(1)
  expect(
    circuitJson.filter((element) => element.type === "schematic_net_label"),
  ).toHaveLength(1)

  const schematicTraces = circuitJson.filter(
    (element): element is SchematicTrace => element.type === "schematic_trace",
  )
  expect(schematicTraces).toHaveLength(1)
  expect(schematicTraces[0]!.edges).toHaveLength(3)
  expect(schematicTraces[0]!.edges).not.toContainEqual({
    from: { x: 0.5, y: -0.2 },
    to: { x: 2, y: -0.5 },
  })

  const svg = convertCircuitJsonToSchematicSvg(circuitJson)
  expect(svg).toContain('data-circuit-json-type="schematic_component"')
  expect(svg).toContain('data-circuit-json-type="schematic_trace"')
  expect(svg).toContain('data-circuit-json-type="schematic_net_label"')
})
