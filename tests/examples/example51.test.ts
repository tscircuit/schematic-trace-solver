import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example51.json"
import "tests/fixtures/matcher"

test("example51", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.netLabelTraceJunctionSolver!.getOutput()
  const recoveredComponent55To57Trace = output.traces.find(
    (trace) =>
      trace.mspPairId.startsWith("net-label-to-trace-") &&
      trace.pinIds.includes("schematic_port_111") &&
      trace.pinIds.includes("schematic_port_116"),
  )
  expect(recoveredComponent55To57Trace).toBeDefined()
  const recoveredNonFacingTrace = output.traces.find(
    (trace) =>
      trace.mspPairId.startsWith("net-label-to-trace-") &&
      trace.pinIds.includes("schematic_port_84") &&
      trace.pinIds.includes("schematic_port_150"),
  )
  expect(recoveredNonFacingTrace).toBeDefined()
  expect(
    output.netLabelPlacements.some((label) =>
      label.pinIds.some(
        (pinId) =>
          pinId === "schematic_port_111" || pinId === "schematic_port_116",
      ),
    ),
  ).toBe(false)

  const recoveredLeftComponent37Junction =
    solver.netLabelTraceJunctionSolver!.recoveredTraces.find(
      (trace) =>
        trace.pinIds.includes("schematic_port_74") &&
        trace.pinIds.includes("schematic_port_68"),
    )
  expect(recoveredLeftComponent37Junction?.tracePath).toEqual([
    { x: 22.5, y: 10.4 },
    { x: 20.4, y: 10.4 },
  ])
  const recoveredRightComponent37Junction =
    solver.netLabelTraceJunctionSolver!.recoveredTraces.find(
      (trace) =>
        trace.pinIds.includes("schematic_port_75") &&
        trace.pinIds.includes("schematic_port_12"),
    )
  expect(recoveredRightComponent37Junction).toBeDefined()
  expect(recoveredRightComponent37Junction!.tracePath[0]).toEqual({
    x: 23.5,
    y: 10.4,
  })
  expect(recoveredRightComponent37Junction!.tracePath.at(-1)).toEqual({
    x: 26.2,
    y: 10.379999999999999,
  })
  expect(
    output.netLabelPlacements.some(
      (label) =>
        label.mspConnectionPairIds.includes(
          "schematic_port_34-schematic_port_74",
        ) ||
        label.mspConnectionPairIds.includes(
          "schematic_port_35-schematic_port_75",
        ),
    ),
  ).toBe(false)

  const recoveredComponent45Junction =
    solver.netLabelTraceJunctionSolver!.recoveredTraces.find((trace) =>
      trace.pinIds.includes("schematic_port_90"),
    )
  expect(recoveredComponent45Junction?.tracePath).toEqual([
    { x: 13, y: -1.8999999999999995 },
    { x: 13, y: -3.7 },
  ])
  const recoveredComponent53Junction =
    solver.netLabelTraceJunctionSolver!.recoveredTraces.find((trace) =>
      trace.pinIds.includes("schematic_port_106"),
    )
  expect(recoveredComponent53Junction?.tracePath).toEqual([
    { x: 13.5, y: -5 },
    { x: 13.3, y: -5 },
    { x: 13.3, y: -4.35 },
    { x: 13.5, y: -4.35 },
    { x: 13.5, y: -3.7 },
  ])
  expect(
    output.netLabelPlacements.some((label) =>
      label.pinIds.some(
        (pinId) =>
          pinId === "schematic_port_90" || pinId === "schematic_port_106",
      ),
    ),
  ).toBe(false)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
