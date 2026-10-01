import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./assets/usb-c-ethernet-schematic.input.json"
import "tests/fixtures/matcher"

test("USB-C Ethernet adapter schematic sheet", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)
  solver.solve()
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
