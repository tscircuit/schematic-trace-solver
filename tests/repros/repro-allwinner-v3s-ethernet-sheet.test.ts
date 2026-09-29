import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import input from "./assets/repro-allwinner-v3s-ethernet-sheet.input.json"

// Reconstructed from the Ethernet sheet in sbc_allwinner_v3s (1).json using
// core e4c437f686004608f47a566fe5ced73fd26cec4f's input builder with default
// routing settings. Original JSX-only settings are unavailable in the export.
// Component, symbol, and net-label names are retained from Circuit JSON for rendering.
test("repro Allwinner V3s Ethernet sheet", async () => {
  const solver = new SchematicTracePipelineSolver(
    structuredClone(input) as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
