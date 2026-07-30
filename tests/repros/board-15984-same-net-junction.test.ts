import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblemJson from "./assets/board-15984-schematic-trace-input.json"
import "tests/fixtures/matcher"

test("board 15984 extends the V3V3 rail through schematic component 8", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const component8Trace =
    solver.sameNetJunctionAlignmentSolver!.outputTraces.find(
      (trace) => trace.mspPairId === "schematic_port_34-schematic_port_33",
    )!
  expect(component8Trace.tracePath[1]!.y).toBeCloseTo(-3.105)
  expect(component8Trace.tracePath[2]!.y).toBeCloseTo(-3.105)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
