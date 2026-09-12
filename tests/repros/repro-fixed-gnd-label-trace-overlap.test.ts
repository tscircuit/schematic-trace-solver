import { expect, test } from "bun:test"
import type { SourceNet } from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import inputProblem from "./assets/repro-fixed-gnd-label-trace-overlap.input.json"

// solver:started input from core PR #3919 at deb549e8, reduced from SparkFun
// VEML7700. Only symbolName/netLabelText are added for readable snapshots;
// routing geometry is unchanged. Core omits the fixed GND label from input.
test("VEML7700 ground route overlaps a fixed label omitted from solver input", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  expect(solver.solved).toBe(true)
  const circuitJson = convertSolverOutputToCircuitJson(solver)
  const refdesBySourceId: Record<string, string> = {
    source_component_0: "U1",
    source_component_1: "C2",
    source_component_2: "D1",
  }
  for (const element of circuitJson) {
    if (element.type === "source_component") {
      element.name =
        refdesBySourceId[element.source_component_id] ?? element.name
    }
  }
  const groundNet = circuitJson.find(
    (element): element is SourceNet =>
      element.type === "source_net" && element.name === "GND",
  )!

  // Render the original fixed label for context only. It is intentionally not
  // added to solver input: doing so would change the captured reproduction.
  // This records the integration failure, not a claim that the solver ignored
  // a supplied obstacle. A fix must provide/preserve fixed-label geometry.
  circuitJson.push({
    type: "schematic_net_label",
    schematic_net_label_id: "fixed_gnd_label",
    text: "GND",
    source_net_id: groundNet.source_net_id,
    anchor_position: { x: -1.1, y: 1.1 },
    center: { x: -1.1, y: 1.01 },
    anchor_side: "top",
    symbol_name: "rail_down",
  })

  expect(
    convertCircuitJsonToSchematicSvg(circuitJson, {
      width: 600,
      height: 1100,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
