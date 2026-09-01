import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-smartwatch-power-sheet.input.json"

const V3V3_TRACE_ID = "schematic_port_47-schematic_port_58"

test("smartwatch power sheet", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    {
      hideRatsNet: true,
    },
  )
  solver.solve()

  const v3v3Trace = solver.sameNetJunctionAlignmentSolver!.outputTraces.find(
    (trace) => trace.mspPairId === V3V3_TRACE_ID,
  )

  expect(v3v3Trace?.tracePath).toHaveLength(4)
  expect(v3v3Trace?.tracePath[0]).toEqual({ x: 10.9, y: -0.4 })
  expect(v3v3Trace?.tracePath[1]?.x).toBeCloseTo(11.9)
  expect(v3v3Trace?.tracePath[1]?.y).toBeCloseTo(-0.4)
  expect(v3v3Trace?.tracePath[2]?.x).toBeCloseTo(11.9)
  expect(v3v3Trace?.tracePath[2]?.y).toBeCloseTo(1)
  expect(v3v3Trace?.tracePath[3]).toEqual({ x: 12.2, y: 1 })
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
