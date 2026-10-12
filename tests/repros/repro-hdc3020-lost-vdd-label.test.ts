import { expect, test } from "bun:test"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import { getSolverSnapshotSvg } from "tests/fixtures/matcher"
import inputProblem from "./assets/repro-hdc3020-lost-vdd-label.input.json"

// Unchanged capture from #959: tscircuit/ti EnvironmentalSensor_HDC3020.
// https://github.com/tscircuit/ti/blob/1123875442fc4c2197ba88cd5ab70d718173ab98/lib/subcircuits/EnvironmentalSensor_HDC3020.circuit.tsx
// Final recovery joins U1/U2 VDD but deletes both labels, disconnecting the
// visible supply wire from the separately labeled R1/R2 supply rail.
test("repro HDC3020 recovery drops the VDD label from the IC supply wire", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as InputProblem,
    {
      hideRatsNet: true,
    },
  )
  solver.solve()
  expect(solver.solved).toBe(true)

  const before = solver.inlineNetLabelSolver!.getOutput()
  const output = solver.netLabelToTraceSolver!.getOutput()
  expect(
    before.netLabelPlacements.filter((l) => l.netId === "VDD"),
  ).toHaveLength(3)
  expect(
    output.netLabelPlacements.filter((l) => l.netId === "VDD"),
  ).toHaveLength(1)

  const supplyWire = output.traces.find(
    (trace) =>
      trace.mspPairId ===
      "net-label-to-trace-schematic_port_0--schematic_port_9",
  )!
  expect(supplyWire).toBeDefined()
  const supplyRail = output.traces.filter(
    (trace) =>
      trace !== supplyWire &&
      trace.globalConnNetId === supplyWire.globalConnNetId,
  )
  expect(supplyRail).toHaveLength(1)
  expect(
    supplyWire.tracePath.every((point) => Math.abs(point.y - 0.525) < 1e-6),
  ).toBe(true)
  expect(supplyRail[0]!.tracePath.every((point) => point.y >= 2.45)).toBe(true)
  expect(
    [...output.netLabelPlacements, ...output.inlineNetLabelPlacements].some(
      (label) =>
        tracePathContainsPoint(supplyWire.tracePath, label.anchorPoint),
    ),
  ).toBe(false)

  // Restore source symbols and label text for display only, after routing.
  solver.inputProblem.chips[2]!.symbolName = "boxresistor_down"
  solver.inputProblem.chips[3]!.symbolName = "boxresistor_down"
  const circuitJson = convertSolverOutputToCircuitJson(solver)
  const netNames = new Map(
    circuitJson
      .filter((e) => e.type === "source_net")
      .map((e) => [e.source_net_id, e.name]),
  )
  for (const element of circuitJson) {
    if (element.type === "schematic_net_label") {
      element.text = netNames.get(element.source_net_id!) ?? element.text
    }
  }
  await expect(
    getSolverSnapshotSvg({ solver, circuitJson }),
  ).toMatchSvgSnapshot(import.meta.path)
})
