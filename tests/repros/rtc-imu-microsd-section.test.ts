import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/rtc-imu-microsd-section.input.json"
import "tests/fixtures/matcher"

test("RTC IMU microSD section trace routing", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
