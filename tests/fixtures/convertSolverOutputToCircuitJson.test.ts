import { expect, test } from "bun:test"
import {
  any_circuit_element,
  type SchematicPort,
  type SchematicTrace,
  type SourcePort,
} from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
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
        {
          pinId: "U1.1",
          displayName: "VCC",
          x: 0.5,
          y: 0.2,
          _facingDirection: "x+",
        },
        { pinId: "U1.2", x: 0.5, y: -0.2, _facingDirection: "x+" },
      ],
    },
    {
      chipId: "schematic_component_1",
      // tscircuit/core passes a text-inclusive obstacle here. These bounds are
      // deliberately much larger and off-center from the capacitor symbol.
      center: { x: 2.2, y: 0.35 },
      width: 2,
      height: 1.6,
      pins: [
        { pinId: "C1.1", x: 2, y: 0.3, _facingDirection: "y+" },
        { pinId: "C1.2", x: 2, y: -0.3, _facingDirection: "y-" },
      ],
    },
    {
      chipId: "schematic_component_2",
      symbolName: "led_right",
      center: { x: 4.35, y: 0.4 },
      width: 2.2,
      height: 1.45,
      pins: [
        { pinId: "LED1.1", x: 3.46, y: 0, _facingDirection: "x-" },
        { pinId: "LED1.2", x: 4.54, y: 0, _facingDirection: "x+" },
      ],
    },
    {
      chipId: "schematic_component_3",
      center: { x: 6, y: 0 },
      width: 2.2,
      height: 1,
      pins: [
        {
          pinId: "schematic_port_opaque_input",
          displayName: "VIN",
          x: 4.9,
          y: 0,
          _facingDirection: "x-",
        },
        {
          pinId: "schematic_port_opaque_output",
          displayName: "VOUT",
          x: 7.1,
          y: 0,
          _facingDirection: "x+",
        },
        {
          pinId: "schematic_port_hidden",
          x: 6,
          y: 0.5,
          _facingDirection: "y+",
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["U1.1", "C1.1"],
      netId: "ROUTED",
      netLabelText: "CLK",
      netLabelWidth: 0.514,
    },
    {
      pinIds: ["U1.2", "C1.2"],
      netId: "UNROUTED",
    },
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
          globalConnNetId: "internal-global-net-id",
          userNetId: "",
          pinIds: ["U1.1", "C1.1"],
          tracePath: [
            { x: 0.5, y: 0.2 },
            { x: 1.2, y: 0.2 },
            { x: 1.2, y: 0.3 },
            { x: 2, y: 0.3 },
          ],
        },
      ],
      netLabelPlacements: [
        {
          globalConnNetId: "internal-global-net-id",
          netId: "   ",
          mspConnectionPairIds: ["routed-trace"],
          pinIds: ["U1.1", "C1.1"],
          orientation: "x+" as const,
          anchorPoint: { x: 1.2, y: 0.2 },
          width: 0.8,
          height: 0.2,
          center: { x: 1.6, y: 0.2 },
        },
        {
          globalConnNetId: "internal-unrouted-net-id",
          netId: "   ",
          mspConnectionPairIds: [],
          pinIds: ["U1.2", "C1.2"],
          orientation: "x+" as const,
          anchorPoint: { x: 0.5, y: -0.2 },
          width: 0.514,
          height: 0.2,
          center: { x: 0.757, y: -0.2 },
        },
      ],
      inlineNetLabelPlacements: [],
    }
  }
}

class FinalStageSnapshotTestSolver extends SnapshotTestSolver {
  netLabelToTraceSolver = {
    getOutput: () => ({
      traces: [],
      netLabelPlacements: [],
      inlineNetLabelPlacements: [],
    }),
  }

  inlineNetLabelSolver = {
    getOutput: () => ({
      traces: this.getOutput().traces,
      netLabelPlacements: [],
      inlineNetLabelPlacements: [],
    }),
  }
}

test("solver snapshot uses the final pipeline stage", () => {
  const circuitJson = convertSolverOutputToCircuitJson(
    new FinalStageSnapshotTestSolver(),
  )

  expect(
    circuitJson.filter((element) => element.type === "schematic_trace"),
  ).toHaveLength(0)
})

test("solver snapshot Circuit JSON is semantic and omits the rats nest", () => {
  const circuitJson = convertSolverOutputToCircuitJson(new SnapshotTestSolver())
  const inputGraphics = visualizeInputProblem(inputProblem)

  expect(
    inputGraphics.points?.find((point) => point.x === 4.9 && point.y === 0)
      ?.label,
  ).toBe("VIN\nx-")
  expect(
    inputGraphics.points?.some((point) => point.label?.includes("opaque")),
  ).toBe(false)

  for (const element of circuitJson) {
    expect(any_circuit_element.safeParse(element).success).toBe(true)
  }

  expect(
    circuitJson.filter((element) => element.type === "schematic_component"),
  ).toHaveLength(4)
  expect(
    circuitJson
      .filter((element) => element.type === "source_component")
      .map((component) => component.name),
  ).toEqual(["U1", "C1", "LED1", ""])
  const genericBoxComponent = circuitJson.find(
    (element) =>
      element.type === "schematic_component" &&
      element.source_component_id === "source_component_0",
  )
  if (genericBoxComponent?.type !== "schematic_component") {
    throw new Error("Expected generic box schematic component")
  }
  expect(genericBoxComponent.size.width).toBeCloseTo(0.2)
  expect(genericBoxComponent.size.height).toBe(1)
  expect(
    circuitJson.find(
      (element) =>
        element.type === "schematic_port" &&
        element.schematic_component_id ===
          genericBoxComponent.schematic_component_id,
    ),
  ).toMatchObject({ distance_from_component_edge: 0.4 })
  expect(
    circuitJson.find(
      (element) =>
        element.type === "source_port" &&
        element.source_port_id === "source_port_0_0",
    ),
  ).toMatchObject({ name: "VCC", pin_number: 1 })
  expect(
    circuitJson.find(
      (element) =>
        element.type === "schematic_port" &&
        element.source_port_id === "source_port_0_0",
    ),
  ).toMatchObject({ display_pin_label: "VCC", pin_number: 1 })
  expect(
    circuitJson.find(
      (element) =>
        element.type === "schematic_component" &&
        element.source_component_id === "source_component_1",
    ),
  ).toMatchObject({ symbol_name: "capacitor_down" })

  const capacitorComponent = circuitJson.find(
    (element) =>
      element.type === "schematic_component" &&
      element.source_component_id === "source_component_1",
  )
  expect(capacitorComponent).toMatchObject({
    center: { x: 2, y: 0 },
    size: { width: 0.9, height: 0.6 },
  })
  if (capacitorComponent?.type !== "schematic_component") {
    throw new Error("Expected capacitor schematic component")
  }
  const ledComponent = circuitJson.find(
    (element) =>
      element.type === "schematic_component" &&
      element.source_component_id === "source_component_2",
  )
  expect(ledComponent).toMatchObject({
    center: { x: 4, y: 0 },
    size: { width: 1.13, height: 0.65 },
    symbol_name: "led_right",
  })
  expect(
    circuitJson
      .filter(
        (element): element is SourcePort =>
          element.type === "source_port" &&
          element.source_component_id === "source_component_3",
      )
      .map((sourcePort) => sourcePort.name),
  ).toEqual(["VIN", "VOUT", ""])

  const capacitorPorts = circuitJson
    .filter(
      (element): element is SchematicPort =>
        element.type === "schematic_port" &&
        element.schematic_component_id ===
          capacitorComponent.schematic_component_id,
    )
    .sort((a, b) => a.center.y - b.center.y)
  expect(capacitorPorts[0]!.center.y).toBeCloseTo(-0.3)
  expect(capacitorPorts[1]!.center.y).toBeCloseTo(0.3)
  expect(
    circuitJson.filter((element) => element.type === "schematic_box"),
  ).toHaveLength(1)
  expect(
    circuitJson.filter((element) => element.type === "schematic_net_label"),
  ).toHaveLength(2)
  expect(
    circuitJson
      .filter((element) => element.type === "schematic_net_label")
      .map((element) => element.text),
  ).toEqual(["CLK", "XXX"])

  const schematicTraces = circuitJson.filter(
    (element): element is SchematicTrace => element.type === "schematic_trace",
  )
  expect(schematicTraces).toHaveLength(1)
  expect(schematicTraces[0]!.edges).toHaveLength(3)
  expect(
    circuitJson.find((element) => element.type === "source_trace"),
  ).toMatchObject({ name: "ROUTED" })
  expect(schematicTraces[0]!.edges).not.toContainEqual({
    from: { x: 0.5, y: -0.2 },
    to: { x: 2, y: -0.3 },
  })

  const svg = convertCircuitJsonToSchematicSvg(circuitJson)
  expect(svg).toContain('data-circuit-json-type="schematic_component"')
  expect(svg).toContain('data-circuit-json-type="schematic_trace"')
  expect(svg).toContain('data-circuit-json-type="schematic_net_label"')
  expect(svg).toContain(">U1</text>")
  expect(svg).toContain(">VCC</text>")
  expect(svg).not.toContain(">schematic_component_3</text>")
  expect(svg).not.toContain(">schematic_port_hidden</text>")
  expect(svg).not.toContain("schematic_port_opaque")
})
