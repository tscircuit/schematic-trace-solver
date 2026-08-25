import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-board-648-esp12f-section.input.json"

test("board 648 ESP-12F power and boot section", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  const output = solver.sameNetJunctionAlignmentSolver!.getOutput()
  expect(
    solver.sameNetJunctionAlignmentSolver!.stats.trimmedSameNetOverlapCount,
  ).toBe(4)
  const gndTrace = output.traces.find(
    (trace) => trace.mspPairId === "schematic_port_60-schematic_port_43",
  )!
  expect(gndTrace.tracePath).toHaveLength(4)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
