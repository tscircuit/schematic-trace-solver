import { expect, test } from "bun:test"
import type { SchematicNetLabel, SourceNet } from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "./convertSolverOutputToCircuitJson"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [
    {
      netId: "0V_INTERNAL",
      pinIds: [],
      isGround: true,
    },
    {
      netId: "GND",
      pinIds: [],
      isGround: false,
    },
  ],
  availableNetLabelOrientations: {
    "0V_INTERNAL": ["y-"],
    GND: ["y-"],
  },
}

class GroundSymbolSnapshotSolver extends BaseSolver {
  inputProblem = inputProblem

  getOutput() {
    return {
      traces: [],
      netLabelPlacements: [
        {
          globalConnNetId: "ground-connectivity-net",
          netId: "0V_INTERNAL",
          netLabelText: "0V",
          mspConnectionPairIds: [],
          pinIds: [],
          orientation: "y-" as const,
          anchorPoint: { x: -0.5, y: 0 },
          width: 0.48,
          height: 0.42,
          center: { x: -0.5, y: -0.21 },
        },
        {
          globalConnNetId: "signal-connectivity-net",
          netId: "GND",
          netLabelText: "GND",
          mspConnectionPairIds: [],
          pinIds: [],
          orientation: "y-" as const,
          anchorPoint: { x: 0.5, y: 0 },
          width: 0.48,
          height: 0.42,
          center: { x: 0.5, y: -0.21 },
        },
      ],
      inlineNetLabelPlacements: [],
    }
  }
}

test("solver snapshots render typed ground nets with the core ground symbol", () => {
  const circuitJson = convertSolverOutputToCircuitJson(
    new GroundSymbolSnapshotSolver(),
  )
  const sourceNets = circuitJson.filter(
    (element): element is SourceNet => element.type === "source_net",
  )
  const schematicNetLabels = circuitJson.filter(
    (element): element is SchematicNetLabel =>
      element.type === "schematic_net_label",
  )

  expect(sourceNets).toEqual([
    expect.objectContaining({ name: "0V_INTERNAL", is_ground: true }),
    expect.objectContaining({ name: "GND", is_ground: false }),
  ])
  expect(schematicNetLabels).toEqual([
    expect.objectContaining({ text: "0V", symbol_name: "rail_down" }),
    expect.objectContaining({ text: "GND", symbol_name: undefined }),
  ])

  const svg = convertCircuitJsonToSchematicSvg(circuitJson, {
    width: 600,
    height: 400,
  })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
