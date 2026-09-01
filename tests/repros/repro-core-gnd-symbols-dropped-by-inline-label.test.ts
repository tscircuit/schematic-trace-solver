import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-core-gnd-symbols-dropped-by-inline-label.input.json"

const gnd2GlobalConnNetId = "connectivity_net2"

// Captured from @tscircuit/core PR #3522's example11-net-symbol test. GND2 has
// three anchored placements that core renders as a left ground symbol, a
// bottom label, and a right label. Once one branch gets an inline label, all
// three anchored placements are currently removed for the shared connectivity
// net.
test("repro: core GND2 symbols are dropped by an inline label", () => {
  const inputProblem = structuredClone(
    inputProblemJson,
  ) as unknown as InputProblem
  delete inputProblem._chipObstacleSpatialIndex
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const inlineSolver = solver.inlineNetLabelSolver!
  const inputGnd2Labels = inlineSolver.inputNetLabelPlacements.filter(
    (placement) => placement.globalConnNetId === gnd2GlobalConnNetId,
  )
  const output = inlineSolver.getOutput()
  const outputGnd2Labels = output.netLabelPlacements.filter(
    (placement) => placement.globalConnNetId === gnd2GlobalConnNetId,
  )
  const inlineGnd2Labels = output.inlineNetLabelPlacements.filter(
    (placement) => placement.globalConnNetId === gnd2GlobalConnNetId,
  )

  expect(inputGnd2Labels.map((placement) => placement.orientation)).toEqual([
    "y-",
    "y+",
    "x+",
  ])
  expect(inlineGnd2Labels).toHaveLength(1)
  expect(outputGnd2Labels).toHaveLength(0)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
