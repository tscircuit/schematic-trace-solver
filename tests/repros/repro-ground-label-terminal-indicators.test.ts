import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import input from "./assets/repro-core-vertical-passive-ground-label-overlap.input.json"

// Preserve the complete eight-component MK1/U1 circuit.
// The red terminal circles are not trace-junction dots.
const solver = new SchematicTracePipelineSolver(
  input as unknown as InputProblem,
)
solver.solve()
const circuitJson = convertSolverOutputToCircuitJson(solver)
const svg = convertCircuitJsonToSchematicSvg(circuitJson, {
  width: 1200,
  height: 1000,
})
const countClass = (className: string) =>
  svg.split(`class="${className}"`).length - 1

test("ground labels exist alongside genuine junctions and open chip pins", async () => {
  expect(input.chips).toHaveLength(8)
  expect(solver.solved).toBe(true)
  const ground = input.netConnections.find((net) => net.isGround)!
  const { netLabelPlacements } = solver.netLabelToTraceSolver!.getOutput()
  for (const pinId of ["schematic_port_7", "schematic_port_9"]) {
    expect(ground.pinIds).toContain(pinId)
    expect(netLabelPlacements).toContainEqual(
      expect.objectContaining({
        netId: ground.netId,
        pinIds: [pinId],
      }),
    )
  }
  // These five U1 pins have no connections in the captured input. Their open
  // indicators must remain visible, as must the existing VCC wire junction.
  const connectedPins = new Set([
    ...input.directConnections.flatMap((connection) => connection.pinIds),
    ...input.netConnections.flatMap((connection) => connection.pinIds),
  ])
  expect(
    input.chips[7]!.pins.filter((pin) => !connectedPins.has(pin.pinId)),
  ).toHaveLength(5)
  expect(countClass("component-pin sch-component-pin sch-port-terminal")).toBe(
    5,
  )
  expect(countClass("trace-junction sch-trace-junction")).toBe(1)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})

// Known failure: the snapshot converter emits the GND labels, but omits their
// source_trace connections. The renderer consequently draws open-pin circles
// on R2 and C3. Remove .failing when fixing the converter, not by hiding circles.
test.failing("ground-labeled passive terminals are not rendered as unconnected", () => {
  for (const sourcePortId of ["source_port_3_1", "source_port_4_1"]) {
    expect(
      circuitJson.some(
        (element) =>
          element.type === "source_trace" &&
          element.connected_source_port_ids.includes(sourcePortId),
      ),
    ).toBe(true)
  }
  expect(countClass("component-pin sch-component-pin")).toBe(0)
})
