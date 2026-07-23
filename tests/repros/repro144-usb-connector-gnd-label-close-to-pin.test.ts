import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro144-usb-connector-gnd-label-close-to-pin.input.json"
import "tests/fixtures/matcher"

// InputProblem extracted from the @tscircuit/core repro
// tests/repros/repro144-usb-connector-gnd-label-close-to-pin.test.tsx
// with DEBUG=Group_doInitialSchematicTraceRender and copying the emitted
// "group-trace-render-input-problem" output.
test("repro144 usb connector GND label close to pin", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
