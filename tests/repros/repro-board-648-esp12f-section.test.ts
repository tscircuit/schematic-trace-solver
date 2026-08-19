import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-board-648-esp12f-section.input.json"

test("board 648 ESP-12F power and boot section", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  const output = solver.sameNetJunctionAlignmentSolver!.getOutput()
  expect(
    solver.sameNetJunctionAlignmentSolver!.stats.trimmedSameNetOverlapCount,
  ).toBe(4)
  for (let traceIndex = 0; traceIndex < output.traces.length; traceIndex++) {
    const trace = output.traces[traceIndex]!
    const laterSameNetTraces = output.traces
      .slice(traceIndex + 1)
      .filter(
        (candidate) => candidate.globalConnNetId === trace.globalConnNetId,
      )
    expect(
      doesPathCoincideWithTraces(trace.tracePath, laterSameNetTraces),
    ).toBe(false)
  }
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
