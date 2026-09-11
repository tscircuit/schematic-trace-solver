import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/rtc-imu-microsd-section.input.json"
import "tests/fixtures/matcher"
import type { InputProblem } from "lib/types/InputProblem"
import { getPathLength } from "lib/solvers/Example28Solver/geometry"

test("RTC IMU microSD section trace routing", () => {
  const problem: InputProblem = JSON.parse(JSON.stringify(inputProblem))
  const solver = new SchematicTracePipelineSolver(problem)
  solver.solve()
  const recoveredTrace = solver
    .unroutedTraceRecoverySolver!.getOutput()
    .newTraces.find(
      (trace) =>
        trace.pinIds.includes("schematic_port_53") &&
        trace.pinIds.includes("schematic_port_32"),
    )!
  expect(recoveredTrace).toBeDefined()
  expect(getPathLength(recoveredTrace.tracePath)).toBeLessThan(4)
  expect(recoveredTrace.tracePath[0]).toMatchObject(recoveredTrace.pins[0])
  expect(recoveredTrace.tracePath.at(-1)).toMatchObject(recoveredTrace.pins[1])
  const finalTrace = solver
    .inlineNetLabelSolver!.getOutput()
    .traces.find((trace) => trace.mspPairId === recoveredTrace.mspPairId)!
  expect(getPathLength(finalTrace.tracePath)).toBeLessThan(3.5)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
