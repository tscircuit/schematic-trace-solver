import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-pga300-redundant-ground-traces.input.json"

// Full solver input captured from tscircuit/ti#117 at 067b6a2 using
// `tsci build ... --schematic-only --disable-pcb --solver-debug`.
// Only the debug serializer's { value_type: "undefined" } markers were removed.
const COMP = "schematic_port_10"
const GND = "schematic_port_7"
const C3_GND = "schematic_port_32"
const R1_GND = "schematic_port_38"

test("repro: PGA300 adds redundant ground branches at COMP", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)
  const { traces } = solver.netLabelToTraceSolver!.getOutput()
  const hasPair = (a: string, b: string) =>
    traces.some((trace) => trace.pinIds.includes(a) && trace.pinIds.includes(b))

  // Current bug: the global GND spanning tree substitutes these two branches
  // for the explicitly requested COMP -> R1 connection in the source circuit.
  expect(hasPair(COMP, GND)).toBe(true)
  expect(hasPair(COMP, C3_GND)).toBe(true)
  expect(hasPair(COMP, R1_GND)).toBe(false)

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
