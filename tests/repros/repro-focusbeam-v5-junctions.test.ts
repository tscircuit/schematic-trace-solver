import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblemJson from "./assets/repro-focusbeam-v5-junctions.input.json"
import "tests/fixtures/matcher"

const LOCAL_V5_PAIR_ID = "schematic_port_10-schematic_port_12"
const EXTERNAL_V5_PAIR_ID = "schematic_port_12-schematic_port_0"

test("keeps the FocusBeam local V5 loop separate from external rails", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const outputTraces = solver.sameNetJunctionAlignmentSolver!.outputTraces
  const localV5Trace = outputTraces.find(
    (trace) => trace.mspPairId === LOCAL_V5_PAIR_ID,
  )!
  const externalV5Trace = outputTraces.find(
    (trace) => trace.mspPairId === EXTERNAL_V5_PAIR_ID,
  )!

  expect(localV5Trace.tracePath[1]!.x).toBeCloseTo(-1.2)
  expect(externalV5Trace.tracePath[1]!.x).not.toBeCloseTo(
    localV5Trace.tracePath[1]!.x,
  )
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
