import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-mpl3115a2-vcc-label-direction.input.json"
import "tests/fixtures/matcher"

// Extracted from:
// boards/SparkFun-Altitude-Pressure-Sensor-Breakout-MPL3115A2/__snapshots__/
// SparkFun-Altitude-Pressure-Sensor-Breakout-MPL3115A2.circuit-schematic.snap.svg
//
// U1.1 (VDD) and U1.4 (VDDIO) share VCC. The solver correctly chooses a y+
// label, but anchors it to the left-hand detour joining the two pins instead
// of directly above the VDD pin column. This makes the VCC connection appear
// to shoot left from VDDIO before turning upward.
test("repro MPL3115A2 VDDIO VCC label anchors left instead of above VDD", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any, {
    hideRatsNet: true,
  })

  solver.solve()

  const vddioTrace = solver.netLabelTraceCollisionSolver!.traces.find(
    (trace) => trace.userNetId === "VCC" && trace.pinIds.includes("U1.4"),
  )
  expect(vddioTrace).toBeDefined()

  const vccLabel =
    solver.netLabelNetLabelCollisionSolver!.outputNetLabelPlacements.find(
      (label) =>
        label.netId === "VCC" &&
        label.mspConnectionPairIds.includes(vddioTrace!.mspPairId),
    )
  expect(vccLabel).toBeDefined()
  expect(vccLabel!.orientation).toBe("y+")

  // Current bug: the upward label is anchored at the detour's x = -1.2,
  // left of the VDD/VDDIO pin column at x = -1. A fix should make this -1.
  expect(vccLabel!.anchorPoint.x).toBeLessThan(-1)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
