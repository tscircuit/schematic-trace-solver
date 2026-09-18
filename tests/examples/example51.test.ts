import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getTraceConnectedPinComponents } from "lib/solvers/SchematicTraceLinesSolver/getTraceConnectedPinComponents"
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

  // Separated power branches remain electrically represented by rail labels.
  // Recovery no longer has to recreate the old downward supply detours.
  for (const pinId of [
    "schematic_port_60",
    "schematic_port_72",
    "schematic_port_73",
    "schematic_port_112",
    "schematic_port_68",
    "schematic_port_74",
    "schematic_port_75",
    "schematic_port_12",
  ]) {
    const net = inputProblem.netConnections.find((net) =>
      net.pinIds.includes(pinId),
    )!
    const component = getTraceConnectedPinComponents({
      pinIds: net.pinIds,
      traces: output.traces,
    }).find((component) => component.pinIds.includes(pinId))!
    expect(
      output.netLabelPlacements.some(
        (label) =>
          label.netId === net.netId &&
          label.pinIds.some((id) => component.pinIds.includes(id)),
      ),
    ).toBe(true)
  }
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
