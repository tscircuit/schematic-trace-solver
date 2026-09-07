import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-trellis-core-decoupling-snake-traces.input.json"

// Captured from Trellis Core (matching core repro182).
// Decoupling capacitors C9-C15 on the P3V3 and GND rails are placed horizontally at y = 8.
//
// Parallel decoupling capacitors on the same power/ground rails should have clean,
// local power (P3V3) and ground (GND) labels/symbols rather than forming serpentine / snake
// trace connections between adjacent capacitors.
test("repro: Trellis Core C9-C15 decoupling capacitors snake traces", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()

  const hasTrace = (pinA: string, pinB: string) =>
    traces.some((t) => t.pinIds.includes(pinA) && t.pinIds.includes(pinB))

  const port: Record<string, string> = {
    "C9.1": "schematic_port_26",
    "C9.2": "schematic_port_27",
    "C10.1": "schematic_port_28",
    "C10.2": "schematic_port_29",
    "C11.1": "schematic_port_30",
    "C11.2": "schematic_port_31",
    "C12.1": "schematic_port_32",
    "C12.2": "schematic_port_33",
    "C13.1": "schematic_port_34",
    "C13.2": "schematic_port_35",
    "C14.1": "schematic_port_36",
    "C14.2": "schematic_port_37",
    "C15.1": "schematic_port_38",
    "C15.2": "schematic_port_39",
  }

  // Decoupling capacitors should not form unwanted snake traces between adjacent capacitors:
  expect(hasTrace(port["C9.1"]!, port["C10.1"]!)).toBe(false)
  expect(hasTrace(port["C11.1"]!, port["C12.1"]!)).toBe(false)
  expect(hasTrace(port["C14.1"]!, port["C15.1"]!)).toBe(false)

  // Decoupling capacitors should have clean ground net labels:
  const gndLabels = netLabelPlacements.filter((l) => l.netId === "GND")
  expect(gndLabels.length).toBeGreaterThan(0)

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
