import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import inputProblem from "./assets/repro-y1-hosco-extra-bends.input.json"

// Reconstructed from the reported 24 MHz crystal schematic. Y1's obstacle
// includes its right-hand value text; its pins retain their symbol directions.
// Expanding the obstacle by even one floating-point unit currently discards
// those directions and moves X2 to the bottom edge, producing a staircase.
// HOSCO should leave Y1 horizontally and turn down once toward C_OSCO.
test("repro Y1 HOSCO takes unnecessary bends before the load capacitor", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as unknown as InputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)
  const output = solver.netLabelToTraceSolver!.getOutput()
  const hoscoTrace = output.traces.find((trace) =>
    trace.pinIds?.includes("Y1.X2"),
  )
  expect(hoscoTrace).toBeDefined()

  const circuitJson = convertSolverOutputToCircuitJson(solver)
  const y1 = circuitJson.find(
    (element) =>
      element.type === "schematic_component" &&
      element.schematic_component_id === "schematic_component_0",
  )
  if (!y1 || y1.type !== "schematic_component") {
    throw new Error("Y1 schematic component is missing")
  }

  // The solver obstacle includes text. Render the original four-pin symbol
  // and bridge its terminals to the corrected solver endpoints, as core does.
  y1.center = { x: 0, y: 0 }
  y1.size = { width: 1.08, height: 1.42 }
  y1.symbol_name = "crystal_4pin_right"
  for (const [pinIndex, pin] of inputProblem.chips[0]!.pins.entries()) {
    const port = circuitJson.find(
      (element) =>
        element.type === "schematic_port" &&
        element.schematic_port_id === `schematic_port_0_${pinIndex}`,
    )
    if (!port || port.type !== "schematic_port") {
      throw new Error(`Y1 port ${pin.pinId} is missing`)
    }
    port.center = { x: pin.x, y: pin.y }
    port.side_of_component = (["top", "bottom", "left", "right"] as const)[
      pinIndex
    ]!
    port.facing_direction = (["up", "down", "left", "right"] as const)[
      pinIndex
    ]!
    for (const trace of circuitJson) {
      if (trace.type !== "schematic_trace") continue
      const first = trace.edges[0]!
      const last = trace.edges.at(-1)!
      if (
        first.from_schematic_port_id === port.schematic_port_id &&
        (first.from.x !== pin.x || first.from.y !== pin.y)
      ) {
        first.from_schematic_port_id = undefined
        trace.edges.unshift({
          from: port.center,
          to: first.from,
          from_schematic_port_id: port.schematic_port_id,
        })
      }
      if (
        last.to_schematic_port_id === port.schematic_port_id &&
        (last.to.x !== pin.x || last.to.y !== pin.y)
      ) {
        last.to_schematic_port_id = undefined
        trace.edges.push({
          from: last.to,
          to: port.center,
          to_schematic_port_id: port.schematic_port_id,
        })
      }
    }
  }

  expect(
    convertCircuitJsonToSchematicSvg(circuitJson, {
      width: 1200,
      height: 800,
    }).replace(/[ \t]+$/gm, ""),
  ).toMatchSvgSnapshot(import.meta.path)
})
