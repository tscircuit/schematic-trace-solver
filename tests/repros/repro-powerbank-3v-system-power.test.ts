import { expect, test } from "bun:test"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { getTraceConnectedPinComponents } from "lib/solvers/SchematicTraceLinesSolver/getTraceConnectedPinComponents"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-powerbank-3v-system-power.input.json"

// Exact solver input captured from the "3 V System Power" sheet in the
// PowerBank example circuit from @tsci/tscircuit.ti.
test("repro PowerBank 3 V System Power schematic", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  const { netConnMap } = getConnectivityMapsFromInputProblem(
    solver.inputProblem,
  )
  const groundGlobalConnNetId = netConnMap.getNetConnectedToId("GND")!
  const groundPinIds = solver.inputProblem.chips
    .flatMap((chip) => chip.pins.map((pin) => pin.pinId))
    .filter(
      (pinId) =>
        netConnMap.getNetConnectedToId(pinId) === groundGlobalConnNetId,
    )
  const groundComponents = getTraceConnectedPinComponents({
    pinIds: groundPinIds,
    traces: output.traces.filter(
      (trace) => trace.globalConnNetId === groundGlobalConnNetId,
    ),
  })

  expect(groundComponents).toHaveLength(1)
  expect(
    output.netLabelPlacements.filter(
      (label) => label.globalConnNetId === groundGlobalConnNetId,
    ),
  ).toHaveLength(1)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
