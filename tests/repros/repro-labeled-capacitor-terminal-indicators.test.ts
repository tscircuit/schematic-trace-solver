import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import "tests/fixtures/matcher"
import { labeledDecouplingCapacitor } from "./assets/labeled-decoupling-capacitor"

const solver = new SchematicTracePipelineSolver(labeledDecouplingCapacitor)
solver.solve()
const circuitJson = convertSolverOutputToCircuitJson(solver)

test("a labeled decoupling capacitor reproduces false terminal indicators", async () => {
  expect(solver.solved).toBe(true)
  const { netLabelPlacements } = solver.netLabelToTraceSolver!.getOutput()
  for (const connection of labeledDecouplingCapacitor.netConnections) {
    expect(netLabelPlacements).toContainEqual(
      expect.objectContaining({
        netId: connection.netId,
        pinIds: connection.pinIds,
      }),
    )
  }
  // Capture the current broken appearance, not a manually corrected drawing.
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})

// Both terminals are electrically connected through their labels. The snapshot
// converter currently drops those source connections. Remove .failing with fix.
test.failing("named-net capacitor terminals have no open-pin indicators", () => {
  const svg = convertCircuitJsonToSchematicSvg(circuitJson)
  expect(svg).not.toContain('class="component-pin sch-component-pin"')
})
