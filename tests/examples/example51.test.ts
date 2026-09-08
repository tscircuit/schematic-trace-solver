import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example51.json"
import "tests/fixtures/matcher"

test("example51", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any, {
    hideRatsNet: true,
  })

  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  const expectedRecoveredPairs = [
    ["schematic_port_113", "schematic_port_110"],
    ["schematic_port_116", "schematic_port_111"],
    ["schematic_port_60", "schematic_port_72"],
    ["schematic_port_73", "schematic_port_112"],
    ["schematic_port_68", "schematic_port_74"],
    ["schematic_port_75", "schematic_port_12"],
  ]

  for (const expectedPair of expectedRecoveredPairs) {
    expect(
      output.traces.some((trace) =>
        expectedPair.every((pinId) => trace.pinIds.includes(pinId)),
      ),
    ).toBe(true)
    expect(
      output.netLabelPlacements.some(
        (label) =>
          label.pinIds.length === 1 && expectedPair.includes(label.pinIds[0]!),
      ),
    ).toBe(false)
  }

  for (const trace of output.traces) {
    for (let index = 0; index < trace.tracePath.length - 1; index++) {
      const start = trace.tracePath[index]!
      const end = trace.tracePath[index + 1]!
      expect(
        Math.abs(start.x - end.x) < 1e-9 || Math.abs(start.y - end.y) < 1e-9,
      ).toBe(true)
    }
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
