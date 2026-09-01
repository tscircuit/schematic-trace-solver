import { expect, test } from "bun:test"
import { traceCrossesBoundsInterior } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-usb-c-cc2-label-over-dn-trace.input.json"

// Regression for tscircuit/schematic-trace-solver#998: the USB_CC2 label is
// placed over the USB_DN_CONN trace, making the schematic appear shorted even
// though the nets are electrically distinct.
test.failing("keeps the USB-C CC2 label clear of the D- trace", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)

  const output = solver.netLabelToTraceSolver!.getOutput()
  const cc2Label = output.netLabelPlacements.find(
    (label) => label.netId === "USB_CC2",
  )!
  const dnTraces = Object.fromEntries(
    output.traces
      .filter(
        (trace) =>
          trace.globalConnNetId !== cc2Label.globalConnNetId &&
          trace.pinIds.includes("J_USB.DN1"),
      )
      .map((trace) => [trace.mspPairId, trace]),
  )

  expect(
    traceCrossesBoundsInterior(
      getRectBounds(cc2Label.center, cc2Label.width, cc2Label.height),
      dnTraces,
    ),
  ).toBe(false)
})
