import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import { readFileSync } from "node:fs"

const inputProblem: InputProblem = JSON.parse(
  readFileSync(
    new URL("./assets/rp2040-robot-controller.input.json", import.meta.url),
    "utf8",
  ),
)

// Captured from core rendering https://tscircuit.com/mohan-bee/rp2040-robot-controller.
// U_M0 pin4 (GND) and pin9 (EP) share a generated ground-label connector.
test("rp2040 robot controller keeps GND connected after junction alignment", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const groundPinIds = ["schematic_port_162", "schematic_port_167"]
  const groundPins = inputProblem.chips
    .flatMap((chip) => chip.pins)
    .filter((pin) => groundPinIds.includes(pin.pinId))
  expect(groundPins).toHaveLength(2)
  for (const output of [
    {
      ...solver.netLabelNetLabelCollisionSolver!.getOutput(),
      traces: solver.netLabelNetLabelCollisionSolver!.traces,
    },
    solver.inlineNetLabelSolver!.getOutput(),
  ]) {
    const label = output.netLabelPlacements.find((item) =>
      item.pinIds.includes(groundPinIds[0]!),
    )!
    expect(label).toBeDefined()
    const rail = output.traces.find(
      (trace) =>
        !solver.availableNetOrientationSolver!.netLabelConnectorTraceIds.has(
          trace.mspPairId,
        ) && groundPinIds.every((pinId) => trace.pinIds.includes(pinId)),
    )!
    expect(rail).toBeDefined()
    for (const pin of groundPins) {
      expect(tracePathContainsPoint(rail.tracePath, pin)).toBe(true)
    }
    // A label can attach directly to the rail or through a retained connector.
    // In either case it must remain electrically joined to both ground pins.
    expect(
      output.traces.some(
        (trace) =>
          trace.globalConnNetId === rail.globalConnNetId &&
          tracePathContainsPoint(trace.tracePath, label.anchorPoint) &&
          trace.tracePath.some((point) =>
            tracePathContainsPoint(rail.tracePath, point),
          ),
      ),
    ).toBe(true)
  }

  expect(
    convertCircuitJsonToSchematicSvg(convertSolverOutputToCircuitJson(solver), {
      width: 1000,
      height: 800,
    }).replace(/[ \t]+$/gm, ""),
  ).toMatchSvgSnapshot(import.meta.path)
})
