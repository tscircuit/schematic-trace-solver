import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./assets/usb-c-ethernet-schematic.input.json"
import "tests/fixtures/matcher"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"

test("USB-C Ethernet adapter schematic sheet", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)
  solver.solve()
  const output = solver.inlineNetLabelSolver!.getOutput()
  const supplyBranch = output.traces.find((trace) =>
    trace.pinIds.includes("schematic_port_41"),
  )!
  const supplyRail = output.traces.find((trace) =>
    trace.pinIds.includes("schematic_port_30"),
  )!
  expect(
    tracePathContainsPoint(
      supplyRail.tracePath,
      supplyBranch.tracePath.at(-1)!,
    ),
  ).toBe(true)
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
  const ioSupplyRail = output.traces.find(
    (trace) => trace.mspPairId === "schematic_port_77-schematic_port_75",
  )!
  const lowerIoSupplyRail = output.traces.find(
    (trace) => trace.mspPairId === "schematic_port_74-schematic_port_61",
  )!
  expect(ioSupplyRail.tracePath).toHaveLength(3)
  expect(ioSupplyRail.tracePath[1]!.x).toBeGreaterThan(
    ioSupplyRail.pins[0].x + 0.4,
  )
  expect(ioSupplyRail.tracePath[1]!.x).toBeCloseTo(
    lowerIoSupplyRail.tracePath[1]!.x,
  )
  const outerRailJunction = {
    x: ioSupplyRail.tracePath[1]!.x,
    y: ioSupplyRail.tracePath[0]!.y,
  }
  const schematicTraces = convertSolverOutputToCircuitJson(solver).filter(
    (element) => element.type === "schematic_trace",
  )
  expect(
    schematicTraces.some((trace) =>
      trace.junctions?.some(
        (junction) =>
          Math.abs(junction.x - outerRailJunction.x) < 1e-6 &&
          Math.abs(junction.y - outerRailJunction.y) < 1e-6,
      ),
    ),
  ).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
