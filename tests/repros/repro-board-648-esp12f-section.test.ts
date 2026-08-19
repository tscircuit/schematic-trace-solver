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
  ).toBe(3)
  const v3V3GlobalNetId = output.traces.find(
    (trace) => trace.userNetId === "V3_3",
  )!.globalConnNetId
  const v3V3Traces = output.traces.filter(
    (trace) => trace.globalConnNetId === v3V3GlobalNetId,
  )
  for (let traceIndex = 0; traceIndex < v3V3Traces.length; traceIndex++) {
    const trace = v3V3Traces[traceIndex]!
    const laterSameNetTraces = v3V3Traces.slice(traceIndex + 1)
    expect(
      doesPathCoincideWithTraces(trace.tracePath, laterSameNetTraces),
    ).toBe(false)
  }
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
