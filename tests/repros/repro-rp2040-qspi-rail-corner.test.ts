import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-rp2040-qspi-rail-corner.input.json"
import "tests/fixtures/matcher"

// Complete solver:started input from @tscircuit/core 0.0.1958 rendering
// tests/components/primitive-components/schematic-section-rp2040.test.tsx.
// Preserve every section and the original routing settings. In the QSPI
// section, V3V3 remains mid-segment after its trace's right-hand corner moves.
test("reproduces the QSPI rail label placement in core's full RP2040 schematic", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
