import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./assets/usb-c-ethernet-schematic.input.json"
import "tests/fixtures/matcher"

test("USB-C Ethernet adapter schematic sheet", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)
  solver.solve()
  const output = solver.inlineNetLabelSolver!.getOutput()
  const bridge = output.traces.find((trace) =>
    trace.pinIds.includes("schematic_port_6"),
  )!
  expect(bridge.tracePath[1]!.x - bridge.pins[0].x).toBeCloseTo(0.2)
  expect(
    output.inlineNetLabelPlacements.some((label) =>
      label.pinIds.includes("schematic_port_8"),
    ),
  ).toBe(true)
  expect(
    output.traces
      .filter((trace) => output.netLabelConnectorTraceIds!.has(trace.mspPairId))
      .some((trace) => trace.globalConnNetId === bridge.globalConnNetId),
  ).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
