import { expect, test } from "bun:test"
import type { CircuitJson } from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import source from "./assets/repro-am3352-06-boot.circuit.json"
import input from "./assets/repro-am3352-06-boot.input.json"

// Full 06-Boot sheet from am3352-dev-board-4layer-dogbone.json.
// The companion markdown records reconstruction details and routing defaults.
test("repro complete AM3352 06-Boot sheet", async () => {
  const problem = structuredClone(input) as InputProblem
  const circuitJson = source as CircuitJson
  const components = circuitJson.filter(
    (element) => element.type === "schematic_component",
  )
  const ports = circuitJson.filter(
    (element) => element.type === "schematic_port",
  )
  expect(components).toHaveLength(33)
  expect(ports).toHaveLength(96)
  expect(problem.chips.map((chip) => chip.chipId)).toEqual(
    components.map((component) => component.schematic_component_id),
  )
  for (const chip of problem.chips) {
    expect(
      chip.pins.map((pin) => ({ id: pin.pinId, x: pin.x, y: pin.y })),
    ).toEqual(
      ports
        .filter((port) => port.schematic_component_id === chip.chipId)
        .map((port) => ({ id: port.schematic_port_id, ...port.center })),
    )
  }
  expect(problem.netConnections).toHaveLength(34)
  for (const connection of problem.netConnections) {
    const net = circuitJson
      .filter((element) => element.type === "source_net")
      .find((net) => net.name === connection.netId)!
    expect(connection.pinIds).toEqual(
      ports
        .filter((port) =>
          circuitJson.some(
            (element) =>
              element.type === "source_port" &&
              element.source_port_id === port.source_port_id &&
              element.subcircuit_connectivity_map_key ===
                net.subcircuit_connectivity_map_key,
          ),
        )
        .map((port) => port.schematic_port_id),
    )
  }

  await expect(
    convertCircuitJsonToSchematicSvg(circuitJson, {
      width: 1600,
      height: 1000,
    }).replace(/[ \t]+$/gm, ""),
  ).toMatchSvgSnapshot(import.meta.path, "repro-am3352-06-boot.source")

  const solver = new SchematicTracePipelineSolver(problem, {
    hideRatsNet: true,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
